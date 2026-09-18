// lib/aep/rpc/dispatch.ts
import type { AepContext } from "../context";
import { AepError } from "../errors";
import { methodCapabilityMap } from "./capability-gates";
import { methodScopeMap } from "../authz/method-scopes";
import { hasScope } from "../authz/scopes";

export type MethodHandler<P = unknown, R = unknown> = (params: P, ctx: AepContext) => Promise<R>;

export class Dispatcher {
  private handlers = new Map<string, MethodHandler>();

  register<P, R>(method: string, handler: MethodHandler<P, R>): void {
    this.handlers.set(method, handler as MethodHandler);
  }

  async dispatch(method: string, params: unknown, ctx: AepContext): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) throw new AepError("tool_not_found", `Unknown method: ${method}`);
    const requiredCap = methodCapabilityMap[method];
    if (requiredCap && !ctx.negotiatedCapabilities[requiredCap]) {
      throw new AepError("capability_not_supported", `Method ${method} requires capability ${requiredCap}`);
    }
    const requiredScope = methodScopeMap[method];
    if (requiredScope && !hasScope(ctx.scopes, requiredScope)) {
      throw new AepError("authz_denied", `Method ${method} requires scope ${requiredScope}`);
    }
    return handler(params, ctx);
  }
}

export const dispatcher = new Dispatcher();
