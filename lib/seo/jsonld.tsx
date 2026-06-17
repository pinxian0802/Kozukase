// 將結構化資料以 <script type="application/ld+json"> 注入頁面。
// 接受單一物件或陣列。
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
