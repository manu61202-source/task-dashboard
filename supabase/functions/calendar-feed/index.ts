// TaskFlow — Calendar Feed Edge Function (multi-user)
// Génère un fichier ICS (RFC 5545) avec les tâches du user identifié par son token.
// Authentification par token UUID stocké dans user_config (key='calendar_token', value={"token":"<uuid>"}).
// Déployée avec verify_jwt: false (Google Calendar / Apple Cal n'envoient pas de Bearer token).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────
const APP_URL = "https://manu61202-source.github.io/task-dashboard/";
const CAL_NAME = "TaskFlow — Mes tâches";
const PRODID = "-//TaskFlow//Calendar Feed//FR";

const PRIORITY_LABELS: Record<string, { emoji: string; label: string }> = {
    critique: { emoji: "🔴", label: "Critique" },
    urgent:   { emoji: "🟠", label: "Urgent" },
    moyen:    { emoji: "🟡", label: "Moyen" },
    faible:   { emoji: "🟢", label: "Faible" },
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers ICS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Échappe les caractères spéciaux pour les valeurs ICS (TEXT type).
 * RFC 5545 §3.3.11
 */
function icsEscape(s: string): string {
    if (!s) return "";
    return s
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n/g, "\\n")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\n");
}

/**
 * Line folding RFC 5545 §3.1 : aucune ligne ne doit dépasser 75 octets.
 * Les lignes pliées commencent par un espace.
 */
function foldLine(line: string): string {
    const MAX = 75;
    if (line.length <= MAX) return line;
    const parts: string[] = [];
    let i = 0;
    parts.push(line.slice(0, MAX));
    i = MAX;
    while (i < line.length) {
        parts.push(" " + line.slice(i, i + (MAX - 1)));
        i += MAX - 1;
    }
    return parts.join("\r\n");
}

/** Format date YYYYMMDD pour DTSTART;VALUE=DATE */
function fmtDate(yyyymmdd: string): string {
    return yyyymmdd.replace(/-/g, "");
}

/** Ajoute 1 jour à une date YYYY-MM-DD (pour DTEND, exclusif en DATE) */
function addOneDay(yyyymmdd: string): string {
    const d = new Date(yyyymmdd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

/** Format timestamp UTC YYYYMMDDTHHMMSSZ pour DTSTAMP / LAST-MODIFIED */
function fmtTimestamp(iso: string | null): string {
    const d = iso ? new Date(iso) : new Date();
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ────────────────────────────────────────────────────────────────────────────
// Construction du VEVENT pour une tâche
// ────────────────────────────────────────────────────────────────────────────

interface Task {
    id: number;
    text: string;
    detail: string | null;
    category: string;
    priority: string;
    deadline: string;
    done: boolean;
    subtasks: Array<{ id: number; text: string; done: boolean }> | null;
    created_at: string | null;
    updated_at: string | null;
}

interface CategoryInfo {
    id: string;
    label: string;
    emoji: string;
    scope: "pro" | "perso";
}

function buildEvent(task: Task, catInfo: CategoryInfo): string[] {
    const lines: string[] = [];
    const pri = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.moyen;
    const checkPrefix = task.done ? "✓ " : "";
    const summary = `${checkPrefix}${catInfo.emoji} ${task.text}`;

    // Description
    const descParts: string[] = [];
    if (task.detail && task.detail.trim()) {
        descParts.push(task.detail.trim());
        descParts.push("");
    }
    const subtasks = task.subtasks || [];
    if (subtasks.length > 0) {
        descParts.push("Sous-tâches :");
        for (const st of subtasks) {
            descParts.push(`${st.done ? "☑" : "☐"} ${st.text}`);
        }
        descParts.push("");
    }
    descParts.push(`Catégorie : ${catInfo.emoji} ${catInfo.label}`);
    descParts.push(`Priorité : ${pri.emoji} ${pri.label}`);
    descParts.push("");
    descParts.push(`→ Voir dans TaskFlow : ${APP_URL}`);
    const description = descParts.join("\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:taskflow-task-${task.id}@taskflow.app`);
    lines.push(`DTSTAMP:${fmtTimestamp(null)}`);
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(task.deadline)}`);
    lines.push(`DTEND;VALUE=DATE:${fmtDate(addOneDay(task.deadline))}`);
    lines.push(`SUMMARY:${icsEscape(summary)}`);
    lines.push(`DESCRIPTION:${icsEscape(description)}`);
    lines.push(`CATEGORIES:${icsEscape(catInfo.label)},${icsEscape(pri.label)}`);
    lines.push(`STATUS:${task.done ? "COMPLETED" : "CONFIRMED"}`);
    if (task.updated_at) {
        lines.push(`LAST-MODIFIED:${fmtTimestamp(task.updated_at)}`);
    }
    if (task.created_at) {
        lines.push(`CREATED:${fmtTimestamp(task.created_at)}`);
    }
    lines.push("END:VEVENT");

    return lines;
}

// ────────────────────────────────────────────────────────────────────────────
// Categories : lecture depuis user_config + fallback
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: { pro: CategoryInfo[]; perso: CategoryInfo[] } = {
    pro: [
        { id: "travail",    label: "Travail",    emoji: "💼", scope: "pro" },
        { id: "entretiens", label: "Entretiens", emoji: "🤝", scope: "pro" },
        { id: "admin",      label: "Admin",      emoji: "📋", scope: "pro" },
    ],
    perso: [
        { id: "appart",  label: "Appart",  emoji: "🏠", scope: "perso" },
        { id: "italien", label: "Italien", emoji: "🇮🇹", scope: "perso" },
        { id: "sport",   label: "Sport",   emoji: "🏃", scope: "perso" },
    ],
};

function getCatInfo(catId: string, cats: { pro: CategoryInfo[]; perso: CategoryInfo[] }): CategoryInfo {
    for (const scope of ["pro", "perso"] as const) {
        const c = cats[scope].find((x) => x.id === catId);
        if (c) return { ...c, scope };
    }
    return { id: catId, label: catId, emoji: "📌", scope: "perso" };
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    try {
        const url = new URL(req.url);
        const token = url.searchParams.get("token");

        if (!token) {
            return new Response("Missing token", { status: 401 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Identifier le user via son token (stocké comme {"token": "<uuid>"} dans user_config)
        const { data: tokenRow, error: tokenErr } = await supabase
            .from("user_config")
            .select("user_id")
            .eq("key", "calendar_token")
            .eq("value->>token", token)
            .maybeSingle();

        if (tokenErr) {
            console.error("Error reading token:", tokenErr);
            return new Response("Server error", { status: 500 });
        }
        if (!tokenRow) {
            return new Response("Invalid token", { status: 401 });
        }
        const userId = tokenRow.user_id;

        // 2. Lire les catégories custom du user (fallback aux defaults si absentes)
        // value est jsonb donc déjà parsé par supabase-js
        let categories = DEFAULT_CATEGORIES;
        const { data: catRow } = await supabase
            .from("user_config")
            .select("value")
            .eq("user_id", userId)
            .eq("key", "custom_categories")
            .maybeSingle();
        if (
            catRow?.value &&
            typeof catRow.value === "object" &&
            "pro" in catRow.value &&
            "perso" in catRow.value
        ) {
            categories = catRow.value as typeof DEFAULT_CATEGORIES;
        }

        // 3. Lire les tâches du user uniquement (filtrage user_id)
        const { data: tasks, error: tasksErr } = await supabase
            .from("tasks")
            .select("id,text,detail,category,priority,deadline,done,subtasks,created_at,updated_at")
            .eq("user_id", userId)
            .not("deadline", "is", null)
            .order("deadline", { ascending: true });

        if (tasksErr) {
            console.error("Error reading tasks:", tasksErr);
            return new Response("Server error", { status: 500 });
        }

        // 4. Construction du fichier ICS
        const lines: string[] = [];
        lines.push("BEGIN:VCALENDAR");
        lines.push("VERSION:2.0");
        lines.push(`PRODID:${PRODID}`);
        lines.push("CALSCALE:GREGORIAN");
        lines.push("METHOD:PUBLISH");
        lines.push(`X-WR-CALNAME:${icsEscape(CAL_NAME)}`);
        lines.push("X-WR-CALDESC:Tâches exportées depuis TaskFlow");
        lines.push("X-WR-TIMEZONE:Europe/Paris");

        for (const task of (tasks || []) as Task[]) {
            const catInfo = getCatInfo(task.category, categories);
            lines.push(...buildEvent(task, catInfo));
        }

        lines.push("END:VCALENDAR");

        // 5. Line folding + CRLF
        const folded = lines.map(foldLine).join("\r\n") + "\r\n";

        return new Response(folded, {
            status: 200,
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Content-Disposition": 'inline; filename="taskflow.ics"',
            },
        });
    } catch (err) {
        console.error("Unexpected error:", err);
        return new Response("Server error", { status: 500 });
    }
});
