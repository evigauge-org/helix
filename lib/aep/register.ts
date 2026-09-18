// lib/aep/register.ts
import { dispatcher } from "./rpc/dispatch";
import { initialize } from "./handlers/initialize";
import * as agent from "./handlers/agent";
import * as run from "./handlers/run";
import * as artifact from "./handlers/artifact";
import * as memory from "./handlers/memory";
import * as message from "./handlers/message";
import * as subject from "./handlers/subject";
import * as provider from "./handlers/provider";
import { agentApprovePromptChange } from "./handlers/approve-prompt-change";

let registered = false;

export function registerAll() {
  if (registered) return;
  dispatcher.register("initialize", initialize);

  dispatcher.register("agent.create", agent.agentCreate);
  dispatcher.register("agent.get", agent.agentGet);
  dispatcher.register("agent.list", agent.agentList);
  dispatcher.register("agent.update", agent.agentUpdate);
  dispatcher.register("agent.cancel", agent.agentCancel);
  dispatcher.register("agent.archive", agent.agentArchive);
  dispatcher.register("agent.approve_prompt_change", agentApprovePromptChange);

  dispatcher.register("run.create", run.runCreate);
  dispatcher.register("run.get", run.runGet);
  dispatcher.register("run.list", run.runList);
  dispatcher.register("run.cancel", run.runCancel);
  dispatcher.register("run.continue", run.runContinue);

  dispatcher.register("artifact.get", artifact.artifactGet);
  dispatcher.register("artifact.list", artifact.artifactList);
  dispatcher.register("artifact.delete", artifact.artifactDelete);

  dispatcher.register("memory.write", memory.memoryWrite);
  dispatcher.register("memory.read", memory.memoryRead);
  dispatcher.register("memory.search", memory.memorySearch);
  dispatcher.register("memory.delete", memory.memoryDelete);

  dispatcher.register("message.send", message.messageSendEmbedder);
  dispatcher.register("message.inbox", message.messageInboxEmbedder);
  dispatcher.register("message.list", message.messageList);

  dispatcher.register("subject.export", subject.subjectExport);
  dispatcher.register("subject.read", subject.subjectRead);
  dispatcher.register("subject.erase", subject.subjectErase);

  dispatcher.register("provider.list", provider.providerList);

  registered = true;
}
