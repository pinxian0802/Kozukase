import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type LegalDocViewProps = {
  title: string
  content: string
}

export function LegalDocView({ title, content }: LegalDocViewProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="sr-only">{title}</h1>
      <div className="legal-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </article>
  )
}
