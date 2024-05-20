import { STATE_SHADERLIST } from '@src/storage/storageConstants';
import { suspend } from 'suspend-react'
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { RepeatWrapping, Texture, TextureLoader } from 'three';
import { getStorage } from '@src/storage/storage';

export type ShaderInstance = {
  shaderText: string;
  channels: Texture[];
  metaData: ShaderMetaData;
}

export type PreloadedShaders = ShaderInstance[];

export function useShaders() {
  return suspend(async () => {
    console.time('useShaders')
    const shaderCatalog = await getStorage<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const textureLoader = new TextureLoader();
    const shaders = await Promise.all(shaderCatalog.shaders.map(async shaderObject => {
      const shaderText = await fetchFragmentShader(shaderObject.shaderName);
      const metaData = shaderObject.metaData;
      const metaDataChannels = [metaData.iChannel0, metaData.iChannel1, metaData.iChannel2, metaData.iChannel3];
      const textures = new Array<Texture>(4);
      for (var i: number = 0; i < textures.length; i++) {
        const textureUrl: string | undefined = metaDataChannels[i];
        if (textureUrl) {
          try { 
            const texture = await textureLoader.loadAsync(textureUrl);
            texture.wrapS = texture.wrapT = RepeatWrapping;
            textures[i] = texture;
          } catch { }
        }
      }
      const instance: ShaderInstance = {
        shaderText: shaderText,
        channels: textures,
        metaData: shaderObject.metaData
      };
      return instance;
    }));

    console.timeEnd('useShaders')
    return shaders;
  }, []);
}
