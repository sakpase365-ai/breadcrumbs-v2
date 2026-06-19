import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbsLayout } from "@/components/layout/BreadcrumbsLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LooseSupabase } from "@/lib/supabase-loose";

type ArchiveEntry = {
  id: string;
  title: string;
  text_body: string | null;
  tags: string[] | null;
  created_at: string;
  breadcrumb_type: string | null;
  domain: string | null;
  relevant_age: number | null;
  recipient: { display_name: string; relationship: string | null } | null;
  recipient_id: string;
};

const all = "all";

export default function Archive() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const db = supabase as unknown as LooseSupabase;
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [query, setQuery] = useState("");
  const [member, setMember] = useState(all);
  const [type, setType] = useState(all);
  const [tag, setTag] = useState(all);
  const [domain, setDomain] = useState(all);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
    if (!isLoading && user && !profile) navigate("/setup");
  }, [isLoading, navigate, profile, user]);

  useEffect(() => {
    if (!profile) return;
    db
      .from<ArchiveEntry[]>("breadcrumbs")
      .select("id,title,text_body,tags,created_at,breadcrumb_type,domain,relevant_age,recipient_id,recipient:recipients(display_name,relationship)")
      .eq("creator_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEntries(data || []));
  }, [profile, db]);

  const options = useMemo(() => {
    const members = new Map<string, string>();
    const types = new Set<string>();
    const tags = new Set<string>();
    const domains = new Set<string>();
    entries.forEach((entry) => {
      if (entry.recipient?.display_name) members.set(entry.recipient_id, entry.recipient.display_name);
      if (entry.breadcrumb_type) types.add(entry.breadcrumb_type);
      if (entry.domain) domains.add(entry.domain);
      (entry.tags || []).forEach((item) => tags.add(item));
    });
    return { members: Array.from(members), types: Array.from(types), tags: Array.from(tags), domains: Array.from(domains) };
  }, [entries]);

  const filtered = entries.filter((entry) => {
    const text = `${entry.title} ${entry.text_body || ""} ${(entry.tags || []).join(" ")}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (member === all || entry.recipient_id === member) &&
      (type === all || entry.breadcrumb_type === type) &&
      (domain === all || entry.domain === domain) &&
      (tag === all || (entry.tags || []).includes(tag))
    );
  });

  if (isLoading || !profile) return <div className="min-h-screen bg-background" />;

  return (
    <BreadcrumbsLayout>
      <div className="pb-24 sm:pb-0">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Family Library</p>
          <h1 className="mt-2 font-serif text-4xl font-medium">Saved breadcrumbs</h1>
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Filter value={member} onChange={setMember} label="Member" options={options.members.map(([value, label]) => ({ value, label }))} />
          <Filter value={type} onChange={setType} label="Type" options={options.types.map((value) => ({ value, label: value }))} />
          <Filter value={tag} onChange={setTag} label="Tag" options={options.tags.map((value) => ({ value, label: value }))} />
          <Filter value={domain} onChange={setDomain} label="Domain" options={options.domains.map((value) => ({ value, label: value }))} />
        </div>

        <div className="mt-5 grid gap-3">
          {filtered.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{entry.breadcrumb_type || "Reflection"}</span>
                <span>for {entry.recipient?.display_name || "family"}</span>
                <span>{format(parseISO(entry.created_at), "MMM d, yyyy")}</span>
                {entry.relevant_age && <span>age {entry.relevant_age}+</span>}
              </div>
              <h2 className="mt-2 font-serif text-2xl font-medium">{entry.title}</h2>
              <p className="mt-3 line-clamp-3 leading-7 text-muted-foreground">{entry.text_body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.domain && <Badge variant="secondary">{entry.domain}</Badge>}
                {(entry.tags || []).map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              No breadcrumbs match those filters yet.
            </div>
          )}
        </div>
      </div>
    </BreadcrumbsLayout>
  );
}

function Filter({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={all}>{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
