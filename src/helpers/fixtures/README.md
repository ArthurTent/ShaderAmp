# Helper test fixtures

- `slVBzm.json`: original Shadertoy export of **storing voxels**, shader ID `slVBzm`, by FabriceNeyret2. Exercises Cube A conversion, self-feedback, keyboard input, and channel mapping. Author metadata and shader source are preserved in the export.
- `27012b4eadd0c3ce12498b867058e4f717ce79e10a99568cca461682d84a4b04.bin`: original Shadertoy grey-volume sample, identified by the filename's asset hash (also recorded in `shadertoyAssetMapping.ts`). Contains a 20-byte `BIN\0` header and 32×32×32 single-channel voxels. Exercises header parsing and storage of voxel data without the header.

These files are read locally by tests; no downloads or external workspace files are required.
