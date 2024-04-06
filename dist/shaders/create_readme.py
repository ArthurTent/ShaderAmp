import os
import json

# Function to read .meta json files in a folder
def read_meta_files(folder_path):
    shader_credits = {}
    
    for file in os.listdir(folder_path):
        if file.endswith(".meta"):
            with open(os.path.join(folder_path, file), "r") as f:
                preview_image = f'../images/preview/{file.replace(".meta","")}.png';
                data = json.load(f)
                shader_name = data.get("shaderName")
                modified_by = data.get("modifiedBy")
                author = data.get("author")
                shader_url = data.get("url")
                license = data.get("license")
                license_url = data.get("licenseURL")
                shader_credits[shader_name] = {"author": author, "modified_by": modified_by, "url": shader_url, 'preview': preview_image, "license": license, "license_url": license_url}
    return shader_credits

# Function to write credits to README.md file
def write_readme(shader_credits):
    with open("README.md", "w") as f:
        f.write("# Shader Credits\n")
        for shader_name, credits in shader_credits.items():
            f.write(f"## {shader_name}\n")
            f.write(f"![ ]({credits['preview']})\n\n");
            f.write(f"Author: {credits['author']}\n\n")
            f.write(f"Modified by: {credits['modified_by']}\n\n")
            f.write(f"Shader URL: {credits['url']}\n\n")
            f.write(f"License: {credits['license']}\n\n")
            f.write(f"License URL: {credits['license_url']}\n\n")


# Main function
if __name__ == "__main__":
    folder_path = "./"
    shader_credits = read_meta_files(folder_path)
    write_readme(shader_credits)

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
