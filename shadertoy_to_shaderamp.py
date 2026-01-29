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


# Shadertoy to ShaderAmp texture mapping
# Maps Shadertoy texture hashes to ShaderAmp local assets
SHADERTOY_TEXTURE_MAP = {
    # Font/Text textures
    "08b42b43ae9d3c0605da11d0eac86618ea888e62cdd9518ee8b9097488b31560": "images/otaviogood_shader_fontgen.png",
    "f735bee5b64ef98879dc618b016ecf7939a5756040c2cde21ccb15e69a6e1cfb": "images/otaviogood_shader_fontgen.png",
    # Noise textures - map to a generic fallback
    "0c7bf5fe9462d5bffbd11126e82908e39be3ce56220d900f633d58fb432e56f5": "images/NyanCatSprite.png",
    "cb49c003b454385aa9975733aff4571c62182ccdda480aaba9a8d250014f00ec": "images/NyanCatSprite.png",
    "cbcbb5a6cfb55c36f8f021fbb0e3f69ac96339a39fa85cd96f2017a2192821b5": "images/NyanCatSprite.png",
    "ad56fba948dfba9ae698198c109e71f118a54d209c0ea50d77ea546abad89c57": "images/NyanCatSprite.png",
    "0a40562379b63dfb89227e6d172f39fdce9022cba76623f1054a2c83d6c0ba5d": "images/NyanCatSprite.png",
    # Nature/Sky textures
    "95b90082f799f48677b4f206d856ad572f1d178c676269eac6347631d4447258": "images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg",
    "92d7758c402f0927011ca8d0a7e40251439fba3a1dac26f5b8b62026323501aa": "images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg",
    "e6e5631ce1237ae4c05b3563eda686400a401df4548d0f9fad40ecac1659c46c": "images/pexels-eberhard-grossgasteiger-966927.jpg",
    "52d2a8f514c4fd2d9866587f4d7b2a5bfa1a11a0e772077d7682deb8b3b517e5": "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
    # Rock/Stone textures
    "79520a3d3a0f4d3caa440802ef4362e99d54e12b1392973e4ea321840970a88a": "images/beton_3_pexels-photo-5622880.jpeg",
    "1f7dca9c22f324751f2a5a59c9b181dfe3b5564a04b724c657732d0bf09c99db": "images/beton_3_pexels-photo-5622880.jpeg",
    "3871e838723dd6b166e490664eead8ec60aedd6b8d95bc8e2fe3f882f0fd90f0": "images/beton_3_pexels-photo-5622880.jpeg",
    # Abstract/Pattern textures
    "fb918796edc3d2221218db0811e240e72e3403500083380c07a52bd353666a6": "images/NyanCatSprite.png",
    "bd6464771e47eed832c5eb2cd85cdc0bfc697786b903bfd30f890f9d4fc36657": "images/NyanCatSprite.png",
    "8de3a3924cb95bd0e95a443fff0326c869f9d4979cd1d5b6e94e2a01f5be53e9": "images/NyanCatSprite.png",
    "488bd40303a2e2b9a71987e48c66ef41f5e937174bf316d3ed0e86410784b919": "images/NyanCatSprite.png",
    # Organic textures
    "3083c722c0c738cad0f468383167a0d246f91af2bfa373e9c5c094fb8c8413e0": "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
    "10eb4fe0ac8a7dc348a2cc282ca5df1759ab8bf680117e4047728100969e7b43": "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
    # Rusty/Metal textures
    "8979352a182bde7c3c651ba2b2f4e0615de819585cc37b7175bcefbca15a6683": "images/beton_3_pexels-photo-5622880.jpeg",
    # Urban textures
    "94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0": "images/pexels-eberhard-grossgasteiger-966927.jpg",
    # Keyboard texture
    "85a6d68622b36995ccb98a89bbb119edf167c914660e4450d313de049320005c": "images/NyanCatSprite.png",
    # Bayer matrix / dithering
    "0681c014f6c88c356cf9c0394ffe015acc94ec1474924855f45d22c3e70b5785": "images/NyanCatSprite.png",
    "793a105653fbdadabdc1325ca08675e1ce48ae5f12e37973829c87bea4be3232": "images/NyanCatSprite.png",
    "550a8cce1bf403869fde66dddf6028dd171f1852f4a704a465e1b80d23955663": "images/NyanCatSprite.png",
    # Pebbles/Gravel
    "cd4c518bc6ef165c39d4405b347b51ba40f8d7a065ab0e8d2e4f422cbc1e8a43": "images/beton_3_pexels-photo-5622880.jpeg",
    "585f9546c092f53ded45332b343144396c0b2d70d9965f585ebc172080d8aa58": "images/beton_3_pexels-photo-5622880.jpeg",
}

# Default fallback texture
DEFAULT_TEXTURE = "images/NyanCatSprite.png"


def extract_hash_from_path(filepath: str) -> Optional[str]:
    """Extract the hash from a Shadertoy filepath."""
    match = re.search(r"/media/a/([a-f0-9]+)\.[a-z]+$", filepath, re.IGNORECASE)
    return match.group(1) if match else None


def map_shadertoy_texture(filepath: str) -> str:
    """Map a Shadertoy texture filepath to a ShaderAmp local path."""
    # Handle buffer references (not textures)
    if "/media/previz/buffer" in filepath:
        return filepath  # Keep as-is, handled separately

    # Extract hash from filepath
    texture_hash = extract_hash_from_path(filepath)
    if not texture_hash:
        print(f"  Warning: Could not extract hash from filepath: {filepath}")
        return DEFAULT_TEXTURE

    # Look up in mapping
    if texture_hash in SHADERTOY_TEXTURE_MAP:
        mapped = SHADERTOY_TEXTURE_MAP[texture_hash]
        print(f"  Mapped texture {texture_hash[:16]}... to {mapped}")
        return mapped

    # No mapping found - use default
    print(
        f"  Warning: No mapping for texture hash: {texture_hash[:16]}..., using default"
    )
    print(f"  Full hash: {texture_hash}")
    print(f"  Original filepath: {filepath}")
    return DEFAULT_TEXTURE


def is_shadertoy_media_path(filepath: str) -> bool:
    """Check if a filepath is a Shadertoy media path."""
    return filepath.startswith("/media/a/") or filepath.startswith("/media/previz/")


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
    """Detect which channel is used for audio input (music, musicstream, or microphone)."""
    for inp in inputs:
        if inp.get("type") in ["music", "musicstream", "microphone"]:
            return inp.get("channel", 0)
    return None


def detect_microphone_channel(inputs: List[Dict]) -> Optional[int]:
    """Detect which channel is used for microphone input specifically."""
    for inp in inputs:
        if inp.get("type") == "microphone":
            return inp.get("channel", 0)
    return None


def detect_video_channel(inputs: List[Dict]) -> Optional[int]:
    """Detect which channel is used for video input."""
    for inp in inputs:
        if inp.get("type") == "video":
            return inp.get("channel", 0)
    return None


def get_texture_inputs(inputs: List[Dict]) -> Dict[int, Dict]:
    """Get texture inputs with their channel numbers (excludes video, handled separately)."""
    textures = {}
    for inp in inputs:
        # Exclude video - it's handled separately via iVideo
        if inp.get("type") in ["texture", "cubemap"]:
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


def replace_video_channel(code: str, video_channel: Optional[int]) -> str:
    """Replace video channel references with iVideo."""
    if video_channel is None:
        return code

    channel_name = f"iChannel{video_channel}"

    # Replace texture/texelFetch calls for the video channel
    # Common patterns:
    # texture(iChannel0, ...) -> texture(iVideo, ...)
    # texelFetch(iChannel0, ...) -> texelFetch(iVideo, ...)
    code = re.sub(rf"\btexture\s*\(\s*{channel_name}\s*,", "texture(iVideo,", code)
    code = re.sub(
        rf"\btexelFetch\s*\(\s*{channel_name}\s*,", "texelFetch(iVideo,", code
    )

    return code


def process_shader_code(
    code: str,
    common_code: str,
    audio_channel: Optional[int],
    video_channel: Optional[int] = None,
    is_buffer: bool = False,
) -> str:
    """Process shader code and wrap it for ShaderAmp."""

    # Replace audio channel references
    processed_code = replace_audio_channel(code, audio_channel)

    # Replace video channel references
    processed_code = replace_video_channel(processed_code, video_channel)

    # Also process common code if present
    if common_code:
        common_code = replace_audio_channel(common_code, audio_channel)
        common_code = replace_video_channel(common_code, video_channel)

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
            # Use asset mapping for Shadertoy media paths
            if is_shadertoy_media_path(filepath):
                meta[channel_key] = map_shadertoy_texture(filepath)
            else:
                # Keep original filename for non-Shadertoy paths
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
    image_microphone_channel = detect_microphone_channel(image_pass.get("inputs", []))
    image_video_channel = detect_video_channel(image_pass.get("inputs", []))

    buffer_audio_channels = {}
    buffer_video_channels = {}
    buffer_microphone_channels = {}
    for letter, bp in buffer_passes.items():
        buffer_audio_channels[letter] = detect_audio_channel(bp.get("inputs", []))
        buffer_video_channels[letter] = detect_video_channel(bp.get("inputs", []))
        buffer_microphone_channels[letter] = detect_microphone_channel(
            bp.get("inputs", [])
        )

    textures = get_texture_inputs(image_pass.get("inputs", []))

    # For display purposes, show any detected audio/video/microphone
    any_audio = image_audio_channel
    any_video = image_video_channel
    any_microphone = image_microphone_channel
    if any_audio is None:
        for ch in buffer_audio_channels.values():
            if ch is not None:
                any_audio = ch
                break
    if any_video is None:
        for ch in buffer_video_channels.values():
            if ch is not None:
                any_video = ch
                break
    if any_microphone is None:
        for ch in buffer_microphone_channels.values():
            if ch is not None:
                any_microphone = ch
                break

    if verbose:
        print(
            f"  Audio channel: {any_audio if any_audio is not None else 'None detected'}"
        )
        if any_microphone is not None:
            print(
                f"  Microphone input detected on channel {any_microphone} -> mapped to iAudioData"
            )
        if any_video is not None:
            print(f"  Video input detected on channel {any_video} -> mapped to iVideo")
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

        # Process buffer shader code (use this buffer's audio/video channel, not global)
        buffer_audio = buffer_audio_channels.get(buffer_letter)
        buffer_video = buffer_video_channels.get(buffer_letter)
        processed_buffer_code = process_shader_code(
            buffer_code,
            common_code,
            buffer_audio,
            video_channel=buffer_video,
            is_buffer=True,
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

    # Process main image pass (use image pass's audio/video channel, not global)
    image_code = image_pass.get("code", "")
    processed_image_code = process_shader_code(
        image_code,
        common_code,
        image_audio_channel,
        video_channel=image_video_channel,
        is_buffer=False,
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
