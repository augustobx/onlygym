import { managementHandlers } from "@/lib/hub-management-http";
import { gymManagement } from "@/lib/hub-management";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = managementHandlers(gymManagement);
export const GET = handlers.GET;
export const POST = handlers.POST;

