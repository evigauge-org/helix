import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Shield, Calendar } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Your personal information.</p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />

      {/* Profile card */}
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardContent className="flex items-center gap-5 pt-6">
          <Avatar className="size-20 border-2 border-[#0085CF]/20">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback className="bg-[#0085CF]/10 text-[#0085CF] text-2xl font-medium">
              {user?.name?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-semibold text-gray-900">{user?.name ?? "Unknown"}</p>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Mail className="size-4 text-[#0085CF]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Shield className="size-4 text-[#0085CF]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Authentication</p>
              <p className="text-sm font-medium text-gray-900">Google OAuth</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Calendar className="size-4 text-[#0085CF]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Member since</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
