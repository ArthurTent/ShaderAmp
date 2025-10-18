export interface ShaderTab {
  id: string;
  label: string;
  description?: string;
  default?: boolean;
}

export interface ShaderMetadata {
  author?: string;
  modifiedBy?: string;
  shaderName?: string;
  url?: string;
  license?: string;
  licenseURL?: string;
  shaderSpeed?: number;
  experimental?: boolean;
  description?: string;
  tab?: string; // Custom tab ID
  customUniforms?: any[];
  [key: string]: any; // Allow additional properties
}

export interface ShaderObject {
  shaderName: string;
  shaderPath: string;
  metadata?: ShaderMetadata;
}

export interface ShaderCatalog {
  shaders: ShaderObject[];
  lastModified: Date | string;
  tabs?: ShaderTab[]; // Optional custom tabs configuration
}

export interface ShaderOption {
  isHidden?: boolean;
  [key: string]: any;
}

export interface ShaderOptions {
  [shaderName: string]: ShaderOption;
}
