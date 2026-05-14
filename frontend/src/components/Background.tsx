/** Decorative full-bleed background: two soft color orbs over a faint grid,
 *  masked toward the center. Purely visual — no interactive surface. */

export function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--color-primary)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--color-accent)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}
