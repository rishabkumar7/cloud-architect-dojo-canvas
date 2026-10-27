const sdkSpecifier = "@github/copilot-sdk/extension";
const sdkUrl = "cloud-architect-dojo:sdk-stub";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === sdkSpecifier) {
    return { url: sdkUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === sdkUrl) {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export class CanvasError extends Error {
          constructor(code, message) {
            super(message);
            this.name = "CanvasError";
            this.code = code;
          }
        }

        export function createCanvas(config) {
          globalThis.__cloudArchitectDojoCanvas = config;
          return config;
        }

        export async function joinSession(config) {
          globalThis.__cloudArchitectDojoSession = config;
          return {
            log(message, options) {
              globalThis.__cloudArchitectDojoLog = { message, options };
            }
          };
        }
      `,
    };
  }
  return nextLoad(url, context);
}
