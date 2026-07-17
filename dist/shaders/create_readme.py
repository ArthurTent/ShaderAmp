import os
import json
import sys
from urllib.parse import quote

# Function to read .meta json files in a folder
def read_meta_files(folder_path):
    metadata = {}
    for file in sorted(os.listdir(folder_path)):
        if file.endswith(".frag.meta") and os.path.isfile(os.path.join(folder_path, file[:-5])):
            with open(os.path.join(folder_path, file), "r", encoding="utf-8") as f:
                metadata[file[:-5]] = json.load(f)

    buffer_files = {
        buffer["shaderName"]
        for data in metadata.values()
        for buffer in data.get("buffers", [])
        if buffer.get("shaderName")
    }
    shader_credits = {}
    for filename, data in metadata.items():
        if data.get("hidden") is True or filename in buffer_files:
            continue
        preview_image = f"../images/preview/{filename}.png"
        if os.path.isfile(os.path.join(folder_path, preview_image)):
            preview_image = quote(preview_image)
        else:
            print(f"Warning: missing preview for {filename}: {preview_image}", file=sys.stderr)
            preview_image = None
        shader_credits[filename] = {
            "name": (data.get("shaderName") or "").strip() or filename.removesuffix(".frag"),
            "author": data.get("author"),
            "modified_by": data.get("modifiedBy"),
            "url": data.get("url"),
            "preview": preview_image,
            "license": data.get("license"),
            "license_url": data.get("licenseURL"),
        }
    return dict(sorted(shader_credits.items(), key=lambda item: (item[1]["name"].casefold(), item[0])))

# Function to write credits to README.md file
def write_readme(shader_credits, output_path=None):
    if output_path is None:
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "README.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Shader Credits\n")
        for credits in shader_credits.values():
            f.write(f"## {credits['name']}\n")
            if credits["preview"]:
                f.write(f"![ ]({credits['preview']})\n")
            f.write("\n")
            for label, key in (
                ("Author", "author"),
                ("Modified by", "modified_by"),
                ("Shader URL", "url"),
                ("License", "license"),
                ("License URL", "license_url"),
            ):
                value = (credits[key] or "").strip()
                if value:
                    f.write(f"{label}: {value}\n\n")


# Main function
if __name__ == "__main__":
    folder_path = os.path.dirname(os.path.abspath(__file__))
    shader_credits = read_meta_files(folder_path)
    write_readme(shader_credits, os.path.join(folder_path, "README.md"))

"""
import json

# Read the .meta json file
with open('shader.meta', 'r') as file:
    shader_data = json.load(file)

# Create README.md file
with open('README.md', 'w') as readme_file:
    readme_file.write("# Shader Credits\n\n")

    for shader_info in shader_data:
        author = shader_info.get('author')
        shader_name = shader_info.get('shaderName')
        shader_url = shader_info.get('shaderURL')

        readme_file.write(f"- **{shader_name}** by {author}\n")
        readme_file.write(f"  [Download]({shader_url})\n\n")

print("README.md file created with shader credits.")
"""
