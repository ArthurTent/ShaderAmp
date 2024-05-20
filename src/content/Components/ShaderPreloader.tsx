import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { STATE_SHADERLIST } from '@src/storage/storageConstants';
import React, { useEffect } from 'react'
import { suspend } from 'suspend-react'
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { RepeatWrapping, Texture, TextureLoader } from 'three';

type Props = {}

const Placeholder = {
  channels: [ 'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg', // channel0
            'images/beton_3_pexels-photo-5622880.jpeg',                               // channel1
              'images/NyanCatSprite.png',                                             // channel2
              'images/NyanCatSprite.png'],                                            // channel3
  video: 'media/SpaceTravel1Min.mp4'
}

export type ShaderInstance = {
    shaderText: string;
    channels: Texture[];
}

export type PreloadedShaders = ShaderInstance[] | undefined;

export function useShaders() {
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    if (shaderCatalog.shaders.length == 0) {
      return;
    }
    return suspend(async () => {
     console.time('doSomething')

     const textureLoader = new TextureLoader();
     const shaders = await Promise.all(shaderCatalog.shaders.map(async shaderObject => {
        const shaderText = await fetchFragmentShader(shaderObject.shaderName);
        const metaData = shaderObject.metaData;
        const metaDataChannels = [metaData.iChannel0, metaData.iChannel1, metaData.iChannel2, metaData.iChannel3];
        const textures = new Array<Texture>(4);
        for (var i : number = 0; i < textures.length; i++) {
            const textureUrl:string = metaDataChannels[i] ?? Placeholder.channels[i];
            const texture = await textureLoader.loadAsync(textureUrl);
            texture.wrapS = texture.wrapT = RepeatWrapping;
            textures[i] = texture;
        }
        const instance: ShaderInstance = {
          shaderText: shaderText,
          channels: textures
        };
        return instance;
      }));

      console.timeEnd('doSomething')
      return shaders;
    }, [shaderCatalog]);
  }

export default function ShaderPreloader({}: Props) {
    
    // declare the async data fetching function
    const shaders = useShaders();

    return (
        null
    )
}