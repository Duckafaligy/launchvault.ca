/* Browser-local Open Agentic Web runtime for LaunchVault.
   Exposes LaunchVault stories and Dot's co-browsing cursor tools via window.LVAgentic and WebMCP (navigator.modelContext). */
(() => {
  "use strict";
  const json = (id) => { try { return JSON.parse(document.getElementById(id).textContent); } catch { return {}; } };
  const data = () => json("lvapp");

  const tools = {
    search_stories({ query = "" } = {}) {
      const q = String(query).toLowerCase().trim();
      const stories = (data().stories || []).filter(
        (s) => !q || s.name.toLowerCase().includes(q) || (s.title || "").toLowerCase().includes(q) || (s.pattern || "").toLowerCase().includes(q)
      );
      return stories.map((s) => ({ slug: s.slug, name: s.name, title: s.title, href: s.href, headline: `${s.hm || "Metric"}: ${s.hv || ""}`, source: s.hs || "" }));
    },
    get_story_facts({ slug = "" } = {}) {
      const s = (data().stories || []).find((x) => x.slug === slug);
      if (!s) return { error: "Story not found" };
      return { slug: s.slug, name: s.name, title: s.title, what: s.what, pattern: s.pattern, href: s.href, numbers: s.nt || [], lessons: s.lessons || [] };
    },
    dot_guide({ instruction = "" } = {}) {
      if (!window.LVDot || !window.LVDot.guide) return { ok: false, reason: "Dot not active on this page" };
      const q = String(instruction).toLowerCase();
      const s = (data().stories || []).find((x) => q.includes(x.slug) || q.includes(x.name.toLowerCase()));
      if (s) {
        window.LVDot.guide(s.href, `Taking you to ${s.name}…`, [{ sel: "#phases", text: `Welcome to ${s.name}!` }]);
        return { ok: true, target: s.href };
      }
      return { ok: false, reason: "No matching UI target" };
    },
  };

  window.LVAgentic = { manifest: "/agent-manifest.json", network: "/launchvault.network.json", tools };

  if (navigator.modelContext && typeof navigator.modelContext.registerTool === "function") {
    try {
      Object.entries(tools).forEach(([name, execute]) => {
        navigator.modelContext.registerTool({ name, description: `LaunchVault agentic-web tool: ${name}`, execute });
      });
    } catch {}
  }
})();
