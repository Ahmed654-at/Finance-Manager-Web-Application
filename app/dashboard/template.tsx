// A template (unlike a layout) re-mounts on every navigation, so each dashboard page fades in when opened.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in-up motion-reduce:animate-none">{children}</div>
}
