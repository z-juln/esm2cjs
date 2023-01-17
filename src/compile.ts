import path from 'path';
import { rollup, RollupOptions, OutputOptions, RollupBuild, Plugin } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { NpmInfo } from './interface';
import { simpleError } from './utils';

// TODO: mjs包: esm + top-level-await的情况
// TODO: 多个入口的情况
async function compile(npmInfo: NpmInfo, productFilepath: string) {
  const { inputOptions, outputOptions } = getOptions(npmInfo, productFilepath);
  await build(inputOptions, outputOptions);
}

const getOptions = ({ dir, main, module }: NpmInfo, productFilepath: string) => {
  const inputOptions: RollupOptions = {
    input: path.resolve(dir, main || 'index.js'),
    plugins: [
      commonjs(),
      nodeResolve({
        // imports 字段和exports字段, 保证能选择node环境, 可以看看chalk@5.2.0的package.json的imports字段
        exportConditions: ['node', 'default', 'module', 'import'],
      }),
      json(),
      getBabelOutputPlugin({
        presets: [
          ["@babel/preset-env", {
            targets: "node 6",
          }],
        ],
        minified: true,
      }),
    ],
  };
  
  const outputOptions: OutputOptions = {
    file: productFilepath,
    format: "cjs",
  };

  return {
    inputOptions,
    outputOptions,
  };
};

async function build(inputOptions: RollupOptions, outputOptions: RollupOptions) {
  async function generateOutputs(bundle: RollupBuild) {
    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    // replace bundle.generate with bundle.write to directly write to disk
    const { output } = await bundle.generate(outputOptions);

    for (const chunkOrAsset of output) {
      if (chunkOrAsset.type === 'asset') {
        // For assets, this contains
        // {
        //   fileName: string,              // the asset file name
        //   source: string | Uint8Array    // the asset source
        //   type: 'asset'                  // signifies that this is an asset
        // }
        // console.log('\n---------Asset\n', chunkOrAsset, '\nAsset---------\n');
        // process.stdout.write(chunkOrAsset.source);
      } else {
        // For chunks, this contains
        // {
        //   code: string,                  // the generated JS code
        //   dynamicImports: string[],      // external modules imported dynamically by the chunk
        //   exports: string[],             // exported variable names
        //   facadeModuleId: string | null, // the id of a module that this chunk corresponds to
        //   fileName: string,              // the chunk file name
        //   implicitlyLoadedBefore: string[]; // entries that should only be loaded after this chunk
        //   imports: string[],             // external modules imported statically by the chunk
        //   importedBindings: {[imported: string]: string[]} // imported bindings per dependency
        //   isDynamicEntry: boolean,       // is this chunk a dynamic entry point
        //   isEntry: boolean,              // is this chunk a static entry point
        //   isImplicitEntry: boolean,      // should this chunk only be loaded after other chunks
        //   map: string | null,            // sourcemaps if present
        //   modules: {                     // information about the modules in this chunk
        //     [id: string]: {
        //       renderedExports: string[]; // exported variable names that were included
        //       removedExports: string[];  // exported variable names that were removed
        //       renderedLength: number;    // the length of the remaining code in this module
        //       originalLength: number;    // the original length of the code in this module
        //       code: string | null;       // remaining code in this module
        //     };
        //   },
        //   name: string                   // the name of this chunk as used in naming patterns
        //   referencedFiles: string[]      // files referenced via import.meta.ROLLUP_FILE_URL_<id>
        //   type: 'chunk',                 // signifies that this is a chunk
        // }
        // console.log('\n---------Chunk\n', chunkOrAsset.modules, '\nChunk---------\n');
        // process.stdout.write(chunkOrAsset.code);
      }
    }

    await bundle.write(outputOptions);
    await bundle.close();
  }

  let bundle: RollupBuild;
  try {
    // create a bundle
    bundle = await rollup(inputOptions);

    // an array of file names this bundle depends on
    // console.log(bundle.watchFiles);

    await generateOutputs(bundle);
  } catch (error) {
    // do some error reporting
    console.error(error);
    throw simpleError('构建失败', 'Npm2cjs/compile Error');
  }
  // @ts-ignore
  if (bundle) {
    // closes the bundle
    await bundle.close();
  }
}

export default compile;
