// Typst 示例模板 - 用于测试渲染效果

#set page(
  width: 700pt,
  height: auto,
  margin: (x: 20pt, y: 20pt),
  fill: white,
)

#set text(
  font: ("LXGW WenKai Mono", "Noto Sans CJK SC"),
  size: 11pt,
  lang: "zh",
)

// 测试提交样式
#grid(
  columns: (auto, 1fr),
  column-gutter: 12pt,
  align: (center, left),
  
  text(size: 24pt, fill: rgb("#0969da"))[📦],
  
  stack(
    dir: ttb,
    spacing: 4pt,
    
    text(
      size: 16pt,
      weight: "bold",
      fill: rgb("#0969da"),
    )[koishijs/koishi],
    
    text(
      size: 10pt,
      fill: rgb("#57606a"),
    )[发现 3 个新提交 · main 分支],
  ),
)

#v(12pt)
#line(length: 100%, stroke: 1pt + rgb("#d0d7de"))
#v(8pt)

// 提交列表
#grid(
  columns: (1fr),
  row-gutter: 0pt,
  
  grid.cell(
    colspan: 3,
    fill: rgb("#f8f9fa"),
    inset: 8pt,
  )[
    #grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      align: (left, left, right),
      
      text(
        size: 9pt,
        font: "monospace",
        fill: rgb("#0969da"),
        weight: "bold",
      )[a1b2c3d],
      
      text(size: 10pt)[feat: add new feature for better performance],
      
      text(
        size: 8pt,
        fill: rgb("#57606a"),
      )[张三 · 01-18 14:30],
    )
  ],
  
  grid.cell(
    colspan: 3,
    fill: white,
    inset: 8pt,
  )[
    #grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      align: (left, left, right),
      
      text(
        size: 9pt,
        font: "monospace",
        fill: rgb("#0969da"),
        weight: "bold",
      )[e4f5g6h],
      
      text(size: 10pt)[fix: resolve memory leak issue],
      
      text(
        size: 8pt,
        fill: rgb("#57606a"),
      )[李四 · 01-18 13:15],
    )
  ],
)

#v(8pt)

#align(center)[
  #text(
    size: 8pt,
    fill: rgb("#57606a"),
  )[更新时间: 2026-01-18 14:30:00 · Powered by Koishi]
]
