'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import type { Category } from '@/lib/types'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { useTranslations } from 'next-intl'

export default function CategoriesAdminPage() {
    const t = useTranslations('adminCategories')
    const [categories, setCategories] = useState<Category[]>([])
    const [newName, setNewName] = useState('')
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [showArchived, setShowArchived] = useState(false)

    const loadCategories = useCallback(async () => {
        setLoading(true)
        const sb = supabaseClient()
        const query = sb.from('categories').select('*').order('name')
        if (showArchived) {
            query.not('deleted_at', 'is', null) // archived
        } else {
            query.is('deleted_at', null) // active
        }
        const { data, error } = await query
        if (error) console.error(error)
        setCategories(data || [])
        setLoading(false)
    }, [showArchived])

    // Hook for automatic refetch when the app returns to the foreground
    useRefetchOnResume(loadCategories)

    useEffect(() => {
        loadCategories()
    }, [loadCategories])

    async function addCategory() {
        if (!newName.trim()) return
        const sb = supabaseClient()

        // temporary category (optimistic)
        const tempCategory: Category = { id: crypto.randomUUID(), name: newName }
        setCategories((prev) => [...prev, tempCategory])
        setNewName('')

        const { data, error } = await sb
            .from('categories')
            .insert({ name: newName })
            .select()
            .single()

        if (error) {
            console.error(error)
            setCategories((prev) => prev.filter((c) => c.id !== tempCategory.id))
            showToast('error', t('categoryCreateError'))
            return
        }

        if (data) {
            setCategories((prev) =>
                prev.map((c) => (c.id === tempCategory.id ? data : c))
            )
        } else {
            setTimeout(loadCategories, 1500)
        }

        showToast('success', t('restored'))
    }

    async function deleteCategory(id: string) {
        if (!window.confirm(t('deleteCategoryConfirm'))) return

        const prev = categories
        setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)))

        const { error } = await supabaseClient()
            .from('categories')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error(error)
            setCategories(prev) // rollback
            showToast('error', t('archiveError'))
            return
        }

        showToast('success', t('categoryMovedToArchive'))
        await loadCategories()
    }

    async function restoreCategory(id: string) {
        const { error } = await supabaseClient()
            .from('categories')
            .update({ deleted_at: null })
            .eq('id', id)

        if (error) {
            console.error(error)
            showToast('error', t('restoreError'))
            return
        }

        showToast('success', t('categoryRestored'))
        loadCategories()
    }

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    return (
        <main className="p-6 max-w-lg mx-auto text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 min-h-screen">

            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                {t('title')}
            </h1>


            <div className="mb-4 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    {t('showArchived')}
                </label>
            </div>

            <div className="mb-6 flex gap-2">
                <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('newCategoryPlaceholder')}
                    className="border border-gray-300 dark:border-gray-600 rounded p-2 flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"

                />
                <button
                    onClick={addCategory}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"

                >
                    {t('add')}
                </button>
            </div>

            {loading && <p>{t('loading')}</p>}

            <ul className="space-y-2 text-gray-900 dark:text-gray-100">

                {categories.map((c) => (
                    <li
                        key={c.id}
                        className="flex justify-between items-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded"

                    >
                        <span>{c.name}</span>
                        {showArchived ? (
                            <button
                                onClick={() => restoreCategory(c.id)}
                                className="text-green-600 hover:underline"
                            >
                                {t('restore')}
                            </button>
                        ) : (
                            <button
                                onClick={() => deleteCategory(c.id)}
                                className="text-red-600 hover:text-red-400 hover:underline transition"

                            >
                                {t('delete')}
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            {toast && (
                <div
                    className={`fixed bottom-4 right-4 px-4 py-2 rounded text-white shadow-lg ${toast.type === 'success'
                        ? 'bg-green-600 dark:bg-green-700'
                        : 'bg-red-600 dark:bg-red-700'
                        }`}

                >
                    {toast.message}
                </div>
            )}
        </main>
    )
}
