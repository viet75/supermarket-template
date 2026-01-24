import Header from '@/components/Header'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <main className="min-h-screen w-full mx-auto px-3 md:px-4 lg:px-6 pb-24 bg-white dark:bg-gray-900 transition-colors">
                {children}
            </main>
        </>
    )
}
