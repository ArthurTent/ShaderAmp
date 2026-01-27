#!/usr/bin/env python3
"""
Shadertoy to ShaderAmp Converter

Converts shaders exported from shadertoy.com (JSON format) to ShaderAmp format
(.frag and .frag.meta files).

Usage:
    python shadertoy_to_shaderamp.py shaders_public.json [output_dir]
    python shadertoy_to_shaderamp.py shaders_public.json [output_dir] --shader-id <id>
    python shadertoy_to_shaderamp.py shaders_public.json [output_dir] --shader-name <name>

Output directory defaults to ./converted_shaders/
"""

import json
import re
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Any


# ShaderAmp uniform header template
SHADERAMP_UNIFORMS = """uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;
"""

# Main wrapper that converts vUv to fragCoord and calls mainImage
SHADERAMP_MAIN_WRAPPER = """
void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
"""

# Buffer shader meta template (hidden from UI)
BUFFER_META_TEMPLATE = {
    "hidden": True,
    "shaderName": "",
    "author": "",
    "license": "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License",
    "licenseURL": "https://creativecommons.org/licenses/by-nc-sa/3.0/",
}

# Shadertoy buffer type to output index mapping
BUFFER_TYPE_MAP = {
    "buffer": {
        "Buffer A": 0,
        "Buffer B": 1,
        "Buffer C": 2,
        "Buffer D": 3,
    }
}


def sanitize_filename(name: str) -> str:
    """Convert shader name to a valid filename."""
    # Remove or replace invalid characters
    sanitized = re.sub(r'[<>:"/\\|?*]', "", name)
    # Replace spaces and special chars with nothing or underscore
    sanitized = re.sub(r"\s+", "", sanitized)
    # Remove leading/trailing whitespace
    sanitized = sanitized.strip()
    # Ensure it's not empty
    if not sanitized:
        sanitized = "UnnamedShader"
    return sanitized


def detect_audio_channel(inputs: List[Dict]) -> Optional[int]:
    """Detect which channel is used for audio input."""
    for inp in inputs:
        if inp.get("type") in ["music", "musicstream", "microphone"]:
            return inp.get("channel", 0)
    return None


def get_texture_inputs(inputs: List[Dict]) -> Dict[int, Dict]:
    """Get texture inputs with their channel numbers."""
    textures = {}
    for inp in inputs:
        if inp.get("type") in ["texture", "cubemap", "video"]:
            channel = inp.get("channel", 0)
            textures[channel] = {
                "filepath": inp.get("filepath", ""),
                "type": inp.get("type"),
                "sampler": inp.get("sampler", {}),
            }
    return textures


def replace_audio_channel(code: str, audio_channel: Optional[int]) -> str:
    """Replace audio channel references with iAudioData."""
    if audio_channel is None:
        return code

    channel_name = f"iChannel{audio_channel}"

    # Replace texture/texelFetch calls for the audio channel
    # Common patterns:
    # texture(iChannel0, ...) -> texture(iAudioData, ...)
    # texelFetch(iChannel0, ...) -> texelFetch(iAudioData, ...)
    code = re.sub(rf"\btexture\s*\(\s*{channel_name}\s*,", "texture(iAudioData,", code)
    code = re.sub(
        rf"\btexelFetch\s*\(\s*{channel_name}\s*,", "texelFetch(iAudioData,", code
    )

    return code


def process_shader_code(
    code: str, common_code: str, audio_channel: Optional[int], is_buffer: bool = False
) -> str:
    """Process shader code and wrap it for ShaderAmp."""

    # Replace audio channel references
    processed_code = replace_audio_channel(code, audio_channel)

    # Also process common code if present
    if common_code:
        common_code = replace_audio_channel(common_code, audio_channel)

    # Check if mainImage function exists
    has_main_image = bool(re.search(r"\bvoid\s+mainImage\s*\(", processed_code))

    # Check if main() already exists (shouldn't in Shadertoy, but just in case)
    has_main = bool(re.search(r"\bvoid\s+main\s*\(\s*\)", processed_code))

    # Build the final shader code
    parts = []

    # Add ShaderAmp uniforms at the top
    parts.append(SHADERAMP_UNIFORMS)

    # Add common code if present (before the main shader code)
    if common_code:
        parts.append("\n// === Common Code ===\n")
        parts.append(common_code.strip())
        parts.append("\n// === End Common Code ===\n\n")

    # Add the processed shader code
    parts.append(processed_code.strip())

    # Add main() wrapper if mainImage exists and main() doesn't
    if has_main_image and not has_main:
        parts.append(SHADERAMP_MAIN_WRAPPER)
    elif not has_main_image and not has_main:
        # No mainImage and no main - this might be a problem
        # Add a simple main() that outputs black
        parts.append(
            """
void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
"""
        )

    return "\n".join(parts)


def create_meta_file(
    shader_info: Dict,
    shader_id: str,
    passes: List[Dict],
    audio_channel: Optional[int],
    textures: Dict[int, Dict],
    buffer_config: List[Dict],
    root_username: str = "Unknown",
) -> Dict:
    """Create the .meta JSON file content."""

    meta = {
        "author": root_username,
        "modifiedBy": "ShaderAmp Converter",
        "shaderName": shader_info.get("name", "Unnamed Shader"),
        "url": f"https://www.shadertoy.com/view/{shader_id}",
        "license": "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License",
        "licenseURL": "https://creativecommons.org/licenses/by-nc-sa/3.0/",
        "shaderSpeed": 1.0,
    }

    # Add description if present
    if shader_info.get("description"):
        meta["description"] = shader_info["description"]

    # Add tags as tab categories if present
    tags = shader_info.get("tags", [])
    if tags:
        meta["tab"] = ["Converted from Shadertoy"]

    # Add buffer configuration for multipass shaders
    if buffer_config:
        meta["buffers"] = buffer_config
        # Find the main image pass output channel reference
        for buf in buffer_config:
            if buf.get("output") == len(buffer_config) - 1:
                # Last buffer feeds into main shader
                meta["iChannel0"] = f"buffer{buf['output']}"
                break
        # Default: main shader reads from last buffer
        if "iChannel0" not in meta and buffer_config:
            last_buffer_idx = max(b["output"] for b in buffer_config)
            meta["iChannel0"] = f"buffer{last_buffer_idx}"

    # Add texture references (skip audio channel)
    for channel, tex_info in textures.items():
        if channel == audio_channel:
            continue
        channel_key = f"iChannel{channel}"
        filepath = tex_info.get("filepath", "")
        if filepath:
            # Convert Shadertoy media path to a local reference
            # e.g., /media/a/xxx.png -> images/xxx.png
            filename = os.path.basename(filepath)
            meta[channel_key] = f"images/{filename}"

    # Add texture wrap setting if any texture uses repeat
    for tex_info in textures.values():
        sampler = tex_info.get("sampler", {})
        if sampler.get("wrap") == "repeat":
            meta["textureWrap"] = "repeat"
            break

    return meta


def create_buffer_meta(base_name: str, buffer_name: str, author: str) -> Dict:
    """Create meta file for a buffer shader."""
    meta = BUFFER_META_TEMPLATE.copy()
    meta["shaderName"] = f"{base_name}{buffer_name}"
    meta["author"] = author
    return meta


def convert_shader(
    shader: Dict, output_dir: Path, verbose: bool = True, root_username: str = "Unknown"
) -> bool:
    """Convert a single shader from Shadertoy format to ShaderAmp format."""

    shader_info = shader.get("info", {})
    shader_id = shader_info.get("id", "unknown")
    shader_name = shader_info.get("name", "UnnamedShader")

    if verbose:
        print(f"\nConverting: {shader_name} (ID: {shader_id})")

    # Get all render passes
    passes = shader.get("renderpass", [])
    if not passes:
        print(f"  Warning: No render passes found, skipping")
        return False

    # Separate passes by type
    image_pass = None
    common_pass = None
    buffer_passes = {}

    for rp in passes:
        rp_type = rp.get("type", "")
        rp_name = rp.get("name", "")

        if rp_type == "image":
            image_pass = rp
        elif rp_type == "common":
            common_pass = rp
        elif rp_type == "buffer":
            # Extract buffer letter from name (e.g., "Buffer A" -> "A")
            match = re.search(r"Buffer\s*([A-D])", rp_name, re.IGNORECASE)
            if match:
                buffer_letter = match.group(1).upper()
                buffer_passes[buffer_letter] = rp

    if not image_pass:
        print(f"  Warning: No image pass found, skipping")
        return False

    # Get common code if present
    common_code = common_pass.get("code", "") if common_pass else ""

    # Detect audio channel per pass (not globally)
    # Each pass may have different audio channel or none
    image_audio_channel = detect_audio_channel(image_pass.get("inputs", []))
    buffer_audio_channels = {}
    for letter, bp in buffer_passes.items():
        buffer_audio_channels[letter] = detect_audio_channel(bp.get("inputs", []))

    textures = get_texture_inputs(image_pass.get("inputs", []))

    # For display purposes, show any detected audio
    any_audio = image_audio_channel
    if any_audio is None:
        for ch in buffer_audio_channels.values():
            if ch is not None:
                any_audio = ch
                break

    if verbose:
        print(
            f"  Audio channel: {any_audio if any_audio is not None else 'None detected'}"
        )
        print(
            f"  Buffer passes: {list(buffer_passes.keys()) if buffer_passes else 'None'}"
        )
        print(f"  Common code: {'Yes' if common_code else 'No'}")

    # Create output filename base
    base_filename = sanitize_filename(shader_name)

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Build buffer configuration for meta file
    buffer_config = []

    # Process buffer passes first
    for buffer_letter in sorted(buffer_passes.keys()):
        buffer_pass = buffer_passes[buffer_letter]
        buffer_idx = ord(buffer_letter) - ord("A")  # A=0, B=1, C=2, D=3

        buffer_filename = f"{base_filename}Buffer{buffer_letter}.frag"
        buffer_code = buffer_pass.get("code", "")

        # Process buffer shader code (use this buffer's audio channel, not global)
        buffer_audio = buffer_audio_channels.get(buffer_letter)
        processed_buffer_code = process_shader_code(
            buffer_code, common_code, buffer_audio, is_buffer=True
        )

        # Write buffer shader
        buffer_path = output_dir / buffer_filename
        with open(buffer_path, "w", encoding="utf-8") as f:
            # Credits header (matching manually converted shaders)
            f.write(f"// https://www.shadertoy.com/view/{shader_id}\n")
            f.write(f"// Modified by ShaderAmp Converter\n")
            f.write(f"// Created by {root_username}\n")
            f.write(
                f"// Original Shader Name: {shader_name} - Buffer {buffer_letter}\n"
            )
            f.write(
                f"// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"
            )
            f.write(f"// https://creativecommons.org/licenses/by-nc-sa/3.0/\n\n")
            f.write(processed_buffer_code)

        if verbose:
            print(f"  Created: {buffer_filename}")

        # Write buffer meta
        buffer_meta = create_buffer_meta(
            base_filename, f"Buffer{buffer_letter}", root_username
        )
        buffer_meta_path = output_dir / f"{buffer_filename}.meta"
        with open(buffer_meta_path, "w", encoding="utf-8") as f:
            json.dump(buffer_meta, f, indent=2)

        if verbose:
            print(f"  Created: {buffer_filename}.meta")

        # Build buffer config entry
        buffer_entry = {"shaderName": buffer_filename, "output": buffer_idx}

        # Check buffer inputs for references to other buffers
        buffer_inputs = buffer_pass.get("inputs", [])
        for inp in buffer_inputs:
            if inp.get("type") == "buffer":
                # This buffer reads from another buffer
                inp_id = inp.get("id", "")
                inp_channel = inp.get("channel", 0)
                # Find which buffer this references by checking outputs
                for other_letter, other_pass in buffer_passes.items():
                    for out in other_pass.get("outputs", []):
                        if out.get("id") == inp_id:
                            other_idx = ord(other_letter) - ord("A")
                            buffer_entry[f"iChannel{inp_channel}"] = (
                                f"buffer{other_idx}"
                            )
                            break

        buffer_config.append(buffer_entry)

    # Process main image pass (use image pass's audio channel, not global)
    image_code = image_pass.get("code", "")
    processed_image_code = process_shader_code(
        image_code, common_code, image_audio_channel, is_buffer=False
    )

    # Determine main shader's channel references
    image_inputs = image_pass.get("inputs", [])
    main_channel_refs = {}
    for inp in image_inputs:
        if inp.get("type") == "buffer":
            inp_id = inp.get("id", "")
            inp_channel = inp.get("channel", 0)
            # Find which buffer this references
            for buffer_letter, buffer_pass in buffer_passes.items():
                for out in buffer_pass.get("outputs", []):
                    if out.get("id") == inp_id:
                        buffer_idx = ord(buffer_letter) - ord("A")
                        main_channel_refs[inp_channel] = f"buffer{buffer_idx}"
                        break

    # Write main shader
    main_filename = f"{base_filename}.frag"
    main_path = output_dir / main_filename
    with open(main_path, "w", encoding="utf-8") as f:
        # Credits header (matching manually converted shaders)
        f.write(f"// https://www.shadertoy.com/view/{shader_id}\n")
        f.write(f"// Modified by ShaderAmp Converter\n")
        f.write(f"// Created by {root_username}\n")
        f.write(f"// Original Shader Name: {shader_name}\n")
        f.write(
            f"// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"
        )
        f.write(f"// https://creativecommons.org/licenses/by-nc-sa/3.0/\n\n")
        f.write(processed_image_code)

    if verbose:
        print(f"  Created: {main_filename}")

    # Create and write meta file
    meta = create_meta_file(
        shader_info,
        shader_id,
        passes,
        image_audio_channel,
        textures,
        buffer_config,
        root_username,
    )

    # Add main shader's buffer channel references
    for channel, ref in main_channel_refs.items():
        meta[f"iChannel{channel}"] = ref

    meta_path = output_dir / f"{main_filename}.meta"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"  Created: {main_filename}.meta")

    return True


def normalize_shader_data(data: Dict) -> tuple:
    """
    Normalize shader data from different Shadertoy export formats.

    Supports:
    - Profile export: {userName, shaders: [{info, renderpass}, ...]}
    - Single shader export: {ver, info, renderpass, flags}

    Returns: (shaders_list, root_username)
    """
    # Check if this is a single shader export (has 'renderpass' at root level)
    if "renderpass" in data and "info" in data:
        # Single shader export format
        shader_info = data.get("info", {})
        username = shader_info.get("username", "Unknown")
        # Wrap it in the profile export structure
        shader = {"info": shader_info, "renderpass": data.get("renderpass", [])}
        return [shader], username

    # Profile export format
    shaders = data.get("shaders", [])
    username = data.get("userName", "Unknown")
    return shaders, username


def main():
    parser = argparse.ArgumentParser(
        description="Convert Shadertoy shaders to ShaderAmp format"
    )
    parser.add_argument(
        "input_file",
        help="Path to Shadertoy JSON export (profile export or single shader)",
    )
    parser.add_argument(
        "output_dir",
        nargs="?",
        default="./converted_shaders",
        help="Output directory for converted shaders (default: ./converted_shaders)",
    )
    parser.add_argument("--shader-id", help="Convert only the shader with this ID")
    parser.add_argument(
        "--shader-name", help="Convert only shaders matching this name (partial match)"
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        default=True,
        help="Verbose output (default: True)",
    )
    parser.add_argument("-q", "--quiet", action="store_true", help="Suppress output")

    args = parser.parse_args()
    verbose = not args.quiet

    # Load input file
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Normalize data from different export formats
    shaders, root_username = normalize_shader_data(data)

    if not shaders:
        print("Error: No shaders found in input file")
        sys.exit(1)

    if verbose:
        print(f"Found {len(shaders)} shader(s) by {root_username} in {input_path}")

    output_dir = Path(args.output_dir)

    # Filter shaders if requested
    if args.shader_id:
        shaders = [s for s in shaders if s.get("info", {}).get("id") == args.shader_id]
        if not shaders:
            print(f"Error: No shader found with ID: {args.shader_id}")
            sys.exit(1)

    if args.shader_name:
        shaders = [
            s
            for s in shaders
            if args.shader_name.lower() in s.get("info", {}).get("name", "").lower()
        ]
        if not shaders:
            print(f"Error: No shader found matching name: {args.shader_name}")
            sys.exit(1)

    # Convert shaders
    success_count = 0
    fail_count = 0

    for shader in shaders:
        try:
            if convert_shader(shader, output_dir, verbose, root_username):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            shader_name = shader.get("info", {}).get("name", "Unknown")
            print(f"Error converting {shader_name}: {e}")
            fail_count += 1

    if verbose:
        print(f"\n{'='*50}")
        print(f"Conversion complete!")
        print(f"  Success: {success_count}")
        print(f"  Failed:  {fail_count}")
        print(f"  Output:  {output_dir.absolute()}")


if __name__ == "__main__":
    main()
