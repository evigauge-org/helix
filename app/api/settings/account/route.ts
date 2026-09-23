// app/api/settings/account/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  RESPONSE_LENGTHS, VOCABULARIES, TONES, REPORT_FORMATS, LANGUAGES, DEFAULT_STYLE,
} from "@/lib/user-style";

// The allowed values and the defaults live in lib/user-style.ts, next to the
// code that turns them into a system prompt — this route validates against the
// same contract the prompt builder reads, so the two cannot drift.
export {
  RESPONSE_LENGTHS, VOCABULARIES, TONES, REPORT_FORMATS, LANGUAGES,
} from "@/lib/user-style";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().trim().url().max(2000).or(z.literal("")).optional(),
  preferredLength: z.enum(RESPONSE_LENGTHS).optional(),
  preferredVocabulary: z.enum(VOCABULARIES).optional(),
  tone: z.enum(TONES).optional(),
  primaryLanguage: z.enum(LANGUAGES).optional(),
  preferredReportFormat: z.enum(REPORT_FORMATS).optional(),
  codeSwitches: z.boolean().optional(),
});

const PROFILE_KEYS = [
  "preferredLength",
  "preferredVocabulary",
  "tone",
  "primaryLanguage",
  "preferredReportFormat",
  "codeSwitches",
] as const;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true, email: true, image: true, avatarUrl: true,
        role: true, emailVerified: true, createdAt: true,
      },
    }),
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        preferredLength: true, preferredVocabulary: true, tone: true,
        primaryLanguage: true, preferredReportFormat: true, codeSwitches: true,
        totalQueries: true, updatedAt: true,
      },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      image: user.avatarUrl ?? user.image,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    },
    // Mirror the schema defaults so the form renders identically whether or not
    // a UserProfile row has been created yet — and so the form agrees with what
    // the prompt builder falls back to for the same user.
    profile: {
      preferredLength: profile?.preferredLength ?? DEFAULT_STYLE.preferredLength,
      preferredVocabulary: profile?.preferredVocabulary ?? DEFAULT_STYLE.preferredVocabulary,
      tone: profile?.tone ?? DEFAULT_STYLE.tone,
      primaryLanguage: profile?.primaryLanguage ?? DEFAULT_STYLE.primaryLanguage,
      // Not part of StyleProfile: this is a file-format default for exports, not
      // a register instruction, so it never reaches a prompt.
      preferredReportFormat: profile?.preferredReportFormat ?? "pdf",
      codeSwitches: profile?.codeSwitches ?? DEFAULT_STYLE.codeSwitches,
      totalQueries: profile?.totalQueries ?? 0,
      updatedAt: profile?.updatedAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const userPatch: { name?: string; avatarUrl?: string | null } = {};
  if (data.name !== undefined) userPatch.name = data.name;
  // An empty string is the explicit "clear it" signal; null falls back to the
  // OAuth-provided image on read.
  if (data.avatarUrl !== undefined) userPatch.avatarUrl = data.avatarUrl === "" ? null : data.avatarUrl;

  const profilePatch = Object.fromEntries(
    PROFILE_KEYS.flatMap((k) => (data[k] === undefined ? [] : [[k, data[k]]])),
  );

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userPatch).length > 0) {
      await tx.user.update({ where: { id: session.user.id }, data: userPatch });
    }
    if (Object.keys(profilePatch).length > 0) {
      await tx.userProfile.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...profilePatch },
        update: profilePatch,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
