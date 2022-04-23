import type { FilePattern } from 'karma';
import type { HMRPayload, ViteDevServer } from 'vite';
import type { DiFactory } from '../types/diFactory';
import type { Config } from '../types/karma';
import { createServer } from 'vite';

export interface ViteProvider extends Promise<ViteDevServer> {
  /**
   * value is undefined when the dependent is framework factory type
   */
  value: ViteDevServer | undefined;
}

export interface Executor {
  schedule: () => void;
}

function filterBelongToVitekarmaFiles(files?: (FilePattern | string)[]) {
  return (
    files &&
    (
      files.filter((file) => {
        if (
          typeof file === 'object' &&
          file.type === 'module' &&
          file.served === false
        ) {
          return true;
        }
      }) as FilePattern[]
    ).map((file) => file.pattern)
  );
}

const viteServerFactory: DiFactory<
  [config: Config, executor: Executor],
  ViteProvider
> = (config, executor) => {
  const { basePath } = config;
  const belongToVitekarmaFiles = filterBelongToVitekarmaFiles(config.files);
  const viteProvider = createServer({
    root: basePath,
    server: {
      middlewareMode: 'ssr',
    },
    optimizeDeps: {
      entries: belongToVitekarmaFiles,
    },
  }).then((vite) => {
    viteProvider.value = vite;
    const send = vite.ws.send.bind(vite.ws);
    vite.ws.send = (payload: HMRPayload) => {
      if (payload.type === 'full-reload') {
        executor.schedule();
      }
      send(payload);
    };
    return vite;
  }) as ViteProvider;
  viteProvider.value = undefined;

  return viteProvider;
};

viteServerFactory.$inject = ['config', 'executor'];

export default viteServerFactory;