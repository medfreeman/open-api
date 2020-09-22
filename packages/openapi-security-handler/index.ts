import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types';

export interface IOpenAPISecurityHandler {
  handle(request: OpenAPI.Request): Promise<void>;
}

export interface OpenAPISecurityHandlerArgs {
  loggingKey: string;
  operationSecurity: (
    | OpenAPIV2.SecurityRequirementObject
    | OpenAPIV3.SecurityRequirementObject
  )[];
  securityDefinitions: OpenAPIV2.SecurityDefinitionsObject;
  securityHandlers: SecurityHandlers;
}

export interface SecurityHandlers {
  [name: string]: SecurityHandler;
}

export type SecurityScope = string;

export type SecurityHandler = (
  req: OpenAPI.Request,
  scopes: SecurityScope[],
  definition: OpenAPIV2.SecuritySchemeObject
) => Promise<boolean> | boolean;

interface SecuritySet {
  definition: OpenAPIV2.SecuritySchemeObject;
  handler: SecurityHandler;
  scopes: string[];
}

export default class OpenAPISecurityHandler implements IOpenAPISecurityHandler {
  private operationSecurity: (
    | OpenAPIV2.SecurityRequirementObject
    | OpenAPIV3.SecurityRequirementObject
  )[];
  private securitySets: SecuritySet[][];

  constructor(args: OpenAPISecurityHandlerArgs) {
    const loggingKey = args && args.loggingKey ? args.loggingKey + ': ' : '';
    if (!args) {
      throw new Error(loggingKey + 'missing args argument');
    }

    const securityDefinitions = args.securityDefinitions;
    const securityHandlers = args.securityHandlers;
    const operationSecurity = args.operationSecurity;

    if (!securityDefinitions || typeof securityDefinitions !== 'object') {
      throw new Error(loggingKey + 'securityDefinitions must be an object');
    }

    if (!securityHandlers || typeof securityHandlers !== 'object') {
      throw new Error(loggingKey + 'securityHandlers must be an object');
    }

    if (!operationSecurity || !Array.isArray(operationSecurity)) {
      throw new Error(loggingKey + 'operationSecurity must be an Array');
    }

    this.operationSecurity = operationSecurity;
    this.securitySets = operationSecurity
      .map((security) => {
        return Object.keys(security)
          .map((scheme) => {
            if (!securityDefinitions[scheme]) {
              throw new Error(
                loggingKey +
                  'Unknown security scheme "' +
                  scheme +
                  '" used in operation.'
              );
            }

            if (!securityHandlers[scheme]) {
              console.warn(
                loggingKey +
                  'No handler defined for security scheme "' +
                  scheme +
                  '"'
              );
              return null;
            }

            if (typeof securityHandlers[scheme] !== 'function') {
              throw new Error(
                loggingKey +
                  'Security handlers must be functions.  Non function ' +
                  'given for scheme "' +
                  scheme +
                  '"'
              );
            }

            return {
              definition: securityDefinitions[scheme],
              handler: securityHandlers[scheme],
              scopes: security[scheme],
            };
          })
          .filter(
            /* tslint:disable-next-line:no-shadowed-variable */
            (security) => {
              return !!security;
            }
          );
      })
      .filter((set) => {
        return set.length > 0;
      });

    if (!this.securitySets.length) {
      this.handle = () => Promise.resolve();
    }
  }

  public async handle(request): Promise<void> {
    const operationSecurity = this.operationSecurity;

    let abort = false;
    const results = await this.securitySets.reduce<
      Promise<ReadonlyArray<boolean | Error>>
    >(
      async (
        promiseChain: Promise<ReadonlyArray<boolean>>,
        currentTask: SecuritySet[]
      ) => {
        const resolvedChain = await promiseChain;
        if (abort === true) {
          return resolvedChain;
        }

        const securitySet = currentTask[0];

        try {
          const result = await securitySet.handler(
            request,
            securitySet.scopes,
            securitySet.definition
          );
          if (result === true) {
            abort = true;
          }

          return Array.prototype.concat(resolvedChain, [result]);
        } catch (err) {
          if (
            !(err instanceof Error) ||
            !('statusCode' in err) ||
            err['statusCode'] >= 500
          ) {
            throw err;
          }
          return Array.prototype.concat(resolvedChain, [err as Error]);
        }
      },
      Promise.resolve([]) as Promise<ReadonlyArray<boolean>>
    );

    return results.some((result) => result === true)
      ? Promise.resolve()
      : Promise.reject(
          results.find((result) => result instanceof Error) ?? {
            status: 401,
            message:
              'No security handlers returned an acceptable response: ' +
              operationSecurity.map(toAuthenticationScheme).join(' OR '),
            errorCode: 'authentication.openapi.security',
          }
        );
  }
}

function toAuthenticationScheme(security) {
  return Object.keys(security).join(' AND ');
}
