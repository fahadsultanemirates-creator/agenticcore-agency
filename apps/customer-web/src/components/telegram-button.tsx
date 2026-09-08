/* Floating Telegram button — sits just above the AI chat button */
export default function TelegramButton() {
  return (
    <div className="fixed bottom-24 right-6 z-50">
      <a
        href="https://t.me/agenticcore"
        target="_blank"
        rel="noreferrer"
        aria-label="Join us on Telegram"
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{ background: '#229ED9' }}
      >
        {/* Official Telegram paper-plane SVG */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.665 4.302C21.14 4.109 21.603 4.55 21.44 5.035L17.514 16.69C17.301 17.32 16.591 17.552 16.037 17.168L11.597 14.097L9.586 16.326C9.379 16.555 9.007 16.486 8.86 16.195L7.338 13.198L3.438 11.906C2.869 11.717 2.86 10.907 3.424 10.704L20.665 4.302Z"/>
        </svg>
      </a>
      <div className="absolute -top-8 right-0 bg-foreground text-white text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
        Telegram
      </div>
    </div>
  );
}
