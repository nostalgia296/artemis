import { type JSX, splitProps, Show } from "solid-js";
import { IconSpinner } from "./Icons";

export function AppShell(props: {
  title: string;
  subtitle?: string;
  left?: JSX.Element;
  right?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="min-h-dvh bg-ios-bg text-ios-label">
      <header class="sticky top-0 z-30 safe-pt ios-blur border-b border-ios-separator/80 bg-ios-bg/75">
        <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div class="flex min-w-10 items-center justify-start">{props.left}</div>
          <div class="min-w-0 flex-1 text-center">
            <h1 class="truncate text-[17px] font-semibold tracking-tight">{props.title}</h1>
            <Show when={props.subtitle}>
              <p class="truncate text-[12px] text-ios-secondary/60">{props.subtitle}</p>
            </Show>
          </div>
          <div class="flex min-w-10 items-center justify-end">{props.right}</div>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6">{props.children}</main>
    </div>
  );
}

export function Card(props: {
  class?: string;
  children: JSX.Element;
  onClick?: () => void;
}) {
  const interactive = !!props.onClick;
  return (
    <div
      class={[
        "rounded-[18px] bg-ios-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
        interactive
          ? "cursor-pointer transition active:scale-[0.99] active:bg-ios-fill/40"
          : "",
        props.class ?? "",
      ].join(" ")}
      onClick={props.onClick}
      role={interactive ? "button" : undefined}
      tabindex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick?.();
        }
      }}
    >
      {props.children}
    </div>
  );
}

export function GroupedList(props: { children: JSX.Element; class?: string }) {
  return (
    <div
      class={[
        "overflow-hidden rounded-[14px] bg-ios-card ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
        props.class ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

export function ListRow(props: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: JSX.Element;
  trailing?: JSX.Element;
  onClick?: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      class={[
        "flex w-full items-center gap-3 px-4 py-3 text-left transition",
        "hover:bg-ios-fill/30 active:bg-ios-fill/50",
        props.last ? "" : "border-b border-ios-separator",
      ].join(" ")}
      onClick={props.onClick}
    >
      <Show when={props.leading}>
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ios-fill text-ios-blue">
          {props.leading}
        </div>
      </Show>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[16px] leading-snug">{props.title}</div>
        <Show when={props.subtitle}>
          <div class="truncate text-[13px] text-ios-secondary/55">{props.subtitle}</div>
        </Show>
      </div>
      <Show when={props.meta}>
        <span class="shrink-0 text-[13px] tabular-nums text-ios-secondary/50">{props.meta}</span>
      </Show>
      <Show when={props.trailing}>{props.trailing}</Show>
    </button>
  );
}

type BtnProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "plain" | "tinted";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export function Button(props: BtnProps) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "loading",
    "block",
    "class",
    "children",
    "disabled",
  ]);
  const variant = () => local.variant ?? "primary";
  const size = () => local.size ?? "md";

  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

  const variants: Record<string, string> = {
    primary: "bg-ios-blue text-white shadow-sm shadow-ios-blue/25 hover:bg-ios-blue-press",
    secondary: "bg-ios-fill text-ios-label hover:bg-ios-fill2",
    danger: "bg-ios-red text-white hover:brightness-95",
    plain: "bg-transparent text-ios-blue hover:bg-ios-fill/40",
    tinted: "bg-ios-blue/12 text-ios-blue hover:bg-ios-blue/18",
  };

  const sizes: Record<string, string> = {
    sm: "h-9 px-3.5 text-[14px]",
    md: "h-11 px-5 text-[15px]",
    lg: "h-12 px-6 text-[16px]",
  };

  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      class={[
        base,
        variants[variant()],
        sizes[size()],
        local.block ? "w-full" : "",
        local.class ?? "",
      ].join(" ")}
    >
      <Show when={local.loading}>
        <IconSpinner size={16} />
      </Show>
      {local.children}
    </button>
  );
}

export function SegmentedControl<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="grid grid-cols-2 rounded-[12px] bg-ios-fill p-1">
      {props.options.map((opt) => {
        const active = () => props.value === opt.value;
        return (
          <button
            type="button"
            class={[
              "rounded-[10px] py-2 text-[14px] font-semibold transition",
              active()
                ? "bg-ios-card text-ios-label shadow-sm"
                : "text-ios-secondary/70",
            ].join(" ")}
            onClick={() => props.onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField(props: {
  value: string;
  placeholder?: string;
  onInput: (v: string) => void;
}) {
  return (
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ios-secondary/45">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" stroke-linecap="round" />
        </svg>
      </div>
      <input
        type="search"
        value={props.value}
        placeholder={props.placeholder ?? "搜索"}
        class="h-10 w-full rounded-[12px] border-0 bg-ios-fill pl-9 pr-3 text-[16px] outline-none placeholder:text-ios-secondary/40 focus:ring-2 focus:ring-ios-blue/30"
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </div>
  );
}

export function ProgressBar(props: { value: number; label?: string }) {
  const pct = () => Math.max(0, Math.min(100, Math.round(props.value)));
  return (
    <div class="space-y-2">
      <Show when={props.label}>
        <div class="flex items-center justify-between text-[13px] text-ios-secondary/70">
          <span>{props.label}</span>
          <span class="tabular-nums">{pct()}%</span>
        </div>
      </Show>
      <div class="h-1.5 overflow-hidden rounded-full bg-ios-fill">
        <div
          class="h-full rounded-full bg-ios-blue transition-[width] duration-300 ease-out"
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState(props: {
  icon?: JSX.Element;
  title: string;
  description?: string;
  action?: JSX.Element;
}) {
  return (
    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Show when={props.icon}>
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-ios-fill text-ios-blue">
          {props.icon}
        </div>
      </Show>
      <h2 class="text-[20px] font-semibold tracking-tight">{props.title}</h2>
      <Show when={props.description}>
        <p class="mt-2 max-w-sm text-[15px] leading-relaxed text-ios-secondary/60">
          {props.description}
        </p>
      </Show>
      <Show when={props.action}>
        <div class="mt-6">{props.action}</div>
      </Show>
    </div>
  );
}

export function Toast(props: { message: string; tone?: "info" | "error" | "success" }) {
  const tone = () => props.tone ?? "info";
  const colors: Record<string, string> = {
    info: "bg-[#1c1c1e]/92 text-white",
    error: "bg-ios-red text-white",
    success: "bg-ios-green text-white",
  };
  return (
    <div
      class={[
        "pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 safe-pb",
      ].join(" ")}
    >
      <div
        class={[
          "max-w-md rounded-full px-4 py-2.5 text-center text-[14px] font-medium shadow-lg backdrop-blur",
          colors[tone()],
        ].join(" ")}
      >
        {props.message}
      </div>
    </div>
  );
}

export function FloatingBar(props: { children: JSX.Element }) {
  return (
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-40 safe-pb">
      <div class="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
        <div class="pointer-events-auto ios-blur rounded-[22px] border border-ios-separator/70 bg-ios-card/85 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          {props.children}
        </div>
      </div>
    </div>
  );
}
