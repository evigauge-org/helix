import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Dock } from "@/components/landing/dock";
import { ChatInputLanding } from "@/components/landing/chat-input-landing";
import { AiOrb } from "@/components/landing/ai-orb";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ArtifactPreviewCanvas } from "@/components/artifacts/artifact-preview-canvas";
import { ArtifactsPanel } from "@/components/artifacts/artifacts-panel";
import { AuthenticatedChatView } from "@/components/chat/authenticated-chat-view";

function UnauthenticatedLanding() {
  return (
    <div className="h-svh w-full overflow-hidden" style={{ background: "#ffffff" }}>
      {/* Centering wrapper with even padding on all sides */}
      <div className="flex h-full w-full items-center justify-center px-0 py-6 sm:px-1 sm:py-8 md:px-2 md:py-10">
        {/* Main card — image lives here, proportionally sized */}
        <div className="relative h-full w-full max-w-[1200px]">

          {/* Background image — rounded, clipped */}
          <div className="absolute inset-0 overflow-hidden rounded-[18px] sm:rounded-[22px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bg.png" alt="" className="h-full w-full object-cover" />
          </div>

          {/* Top groove — top edge flush with image edge, hangs down into image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Rectangle 1.png"
            alt=""
            className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 h-auto w-[260px] sm:w-[290px] md:w-[311px]"
          />

          {/* Dock icons — inside the groove, below image top edge */}
          <div className="absolute top-[5px] left-1/2 z-20 -translate-x-1/2">
            <Dock isAuthenticated={false} />
          </div>

          {/* Bottom groove — half visible as semicircle on image, half hidden below */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Ellipse 1.png"
            alt=""
            className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 h-auto w-[100px] sm:w-[110px] md:w-[120px]"
          />

          {/* Siri orb — sits in the visible semicircle part on the image */}
          <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-[35%]">
            <AiOrb isAuthenticated={false} />
          </div>

          {/* Chat input — dead center of image */}
          <div className="absolute inset-0 z-10 flex items-center justify-center px-8 sm:px-16 md:px-24">
            <ChatInputLanding />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedHome() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col h-svh overflow-hidden bg-white">
        <ArtifactPreviewCanvas />
        <ArtifactsPanel />
        <AuthenticatedChatView />
      </main>
    </SidebarProvider>
  );
}

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) return <AuthenticatedHome />;
  return <UnauthenticatedLanding />;
}
