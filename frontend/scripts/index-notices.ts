import "dotenv/config"
import { indexAllPublishedNotices } from "@/lib/lensbot/index-all"

async function main() {
  console.log("Indexing published notices into pgvector…")
  const { notices, chunks } = await indexAllPublishedNotices()
  console.log(`Done: ${notices} notices → ${chunks} chunks embedded.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
