import type { JSX } from "solid-js";

type IconProps = JSX.SvgSVGAttributes<SVGSVGElement> & { size?: number };

function base(props: IconProps, paths: JSX.Element) {
  const size = props.size ?? 22;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths}
    </svg>
  );
}

export function IconArchive(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-11Z" />
      <path d="M4 9h16" />
      <path d="M9 5v4" />
      <path d="M15 5v4" />
      <path d="M9 14h6" />
    </>,
  );
}

export function IconFolder(props: IconProps) {
  return base(
    props,
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
    </>,
  );
}

export function IconFile(props: IconProps) {
  return base(
    props,
    <>
      <path d="M7 3.5h6.5L18 8v12.5A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5v-15A2 2 0 0 1 7 3.5Z" />
      <path d="M13 3.5V8h5" />
    </>,
  );
}

export function IconPlus(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>,
  );
}

export function IconDownload(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5L16.5 11" />
      <path d="M5 19h14" />
    </>,
  );
}

export function IconChevronLeft(props: IconProps) {
  return base(
    props,
    <>
      <path d="m15 5-7 7 7 7" />
    </>,
  );
}

export function IconSearch(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>,
  );
}

export function IconX(props: IconProps) {
  return base(
    props,
    <>
      <path d="M7 7l10 10" />
      <path d="M17 7 7 17" />
    </>,
  );
}

export function IconTrash(props: IconProps) {
  return base(
    props,
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M8 7l.7 12.2A1.5 1.5 0 0 0 10.2 20.5h3.6a1.5 1.5 0 0 0 1.5-1.3L16 7" />
    </>,
  );
}

export function IconCheck(props: IconProps) {
  return base(
    props,
    <>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </>,
  );
}

export function IconSpinner(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      class={`animate-spin ${props.class ?? ""}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.2"
        stroke-width="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
  );
}
