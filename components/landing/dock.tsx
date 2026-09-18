import { cn } from "@/lib/utils";
import { SignInButton } from "@/components/auth/sign-in-button";
import { MessageCircle, Sparkles, Phone, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function DockIcon({
  children,
  className,
  tooltip,
}: {
  children: React.ReactNode;
  className?: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-[10px] text-white transition-all hover:scale-110 cursor-pointer shadow-md",
            className,
          )}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function Dock({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <DockIcon tooltip="Chat" className="bg-amber-500">
        <MessageCircle className="size-4" />
      </DockIcon>
      <DockIcon tooltip="Explore" className="bg-yellow-500">
        <Sparkles className="size-4" />
      </DockIcon>
      <DockIcon tooltip="Voice" className="bg-sky-500">
        <Phone className="size-4" />
      </DockIcon>
      <DockIcon tooltip="Dashboard" className="bg-blue-600">
        <LayoutGrid className="size-4" />
      </DockIcon>
      {!isAuthenticated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SignInButton />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Sign in with Google
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
