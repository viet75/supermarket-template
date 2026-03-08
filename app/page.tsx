import PublicLayout from '@/app/(public)/layout'
import PublicPage from '@/app/(public)/page'

export default async function RootPage() {
  return (
    <PublicLayout>
      <PublicPage />
    </PublicLayout>
  )
}
