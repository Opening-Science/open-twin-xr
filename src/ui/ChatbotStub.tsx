/**
 * AI chatbot placeholder.
 *
 * DELIBERATELY INERT. The AI integration layer is explicitly out of scope for
 * this repo (per project brief). This component only renders the visual bubble
 * from the mockup so the layout is complete. Do NOT wire an LLM here without a
 * separate decision on the AI layer, data privacy, and provider.
 */
export function ChatbotStub() {
  return (
    // Collapsed to the avatar by default: the greeting bubble sat across the
    // twin's lower torso, and the body is the point of this panel. It expands
    // on hover, which is enough to show the intent in the mockup.
    <div className="group flex items-end gap-3 justify-end">
      <div
        className="pointer-events-none max-w-xs rounded-2xl rounded-br-sm border border-white/60 bg-panel px-4 py-2 text-sm text-ink opacity-0 shadow-sm backdrop-blur-panel transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden="true"
      >
        This is the AI Chatbot, how may I assist you?
      </div>
      <div className="h-12 w-12 shrink-0 rounded-full border border-white/70 bg-gradient-to-br from-white to-[#dfeaf1] shadow-inner" />
    </div>
  )
}
