"use client";

import { useSession } from "@/lib/auth-client";

export function Greeting() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  const hour = new Date().getHours();
  let timeGreeting = "Good evening";
  if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 17) timeGreeting = "Good afternoon";

  return (
    <div className="text-center mb-6">
      <h1 className="text-2xl sm:text-3xl font-medium text-gray-800">
        {timeGreeting},{" "}
        <span className="relative inline-block">
          {name}
          {/* Wavy underline */}
          <svg
            className="absolute -bottom-1 left-0 w-full"
            height="6"
            viewBox="0 0 100 6"
            preserveAspectRatio="none"
          >
            <path
              d="M0 3 Q 12.5 0, 25 3 Q 37.5 6, 50 3 Q 62.5 0, 75 3 Q 87.5 6, 100 3"
              fill="none"
              stroke="#0085CF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </h1>
    </div>
  );
}
