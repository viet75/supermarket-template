import AdminSidebar from '../components/AdminSidebar'

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Sidebar fissa / collassabile - solo per route protette (panel) */}
            <AdminSidebar />

            {/* Contenuto principale */}
            <main
                className="flex-1 min-h-screen p-6 pt-20 md:pt-6 overflow-x-hidden md:ml-64
                           bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
                {children}
            </main>
        </div>
    )
}
