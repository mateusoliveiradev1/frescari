import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ all: string[] }> }) {
    return auth.handler(request);
}

export async function POST(request: NextRequest, context: { params: Promise<{ all: string[] }> }) {
    return auth.handler(request);
}
