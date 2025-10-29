import React, { useState } from 'react'
import { Archive, CheckCircle, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { themeClasses, combineThemeClasses } from '../styles/theme'

const ArchiveButton = ({ 
  items, 
  onArchiveSelected, 
  onArchiveAll, 
  archiveAllLabel = "Archive All",
  archiveSelectedLabel = "Archive Selected",
  archiveAllCondition = null,
  archiveSelectedCondition = null
}) => {
  const { theme } = useTheme()
  const [selectedItems, setSelectedItems] = useState([])
  const [showArchiveOptions, setShowArchiveOptions] = useState(false)

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map(item => item.id))
    }
  }

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const handleArchiveSelected = () => {
    const itemsToArchive = items.filter(item => selectedItems.includes(item.id))
    if (archiveSelectedCondition) {
      const filteredItems = itemsToArchive.filter(archiveSelectedCondition)
      onArchiveSelected(filteredItems)
    } else {
      onArchiveSelected(itemsToArchive)
    }
    setSelectedItems([])
    setShowArchiveOptions(false)
  }

  const handleArchiveAll = () => {
    if (archiveAllCondition) {
      const filteredItems = items.filter(archiveAllCondition)
      onArchiveAll(filteredItems)
    } else {
      onArchiveAll(items)
    }
    setSelectedItems([])
    setShowArchiveOptions(false)
  }

  const hasSelectedItems = selectedItems.length > 0
  const allItemsSelected = selectedItems.length === items.length

  return (
    <div className="relative">
      <button
        onClick={() => setShowArchiveOptions(!showArchiveOptions)}
        className={combineThemeClasses("btn btn-primary", themeClasses.button.primary)}
      >
        <Archive className="h-4 w-4 mr-2" />
        Archive
      </button>

      {showArchiveOptions && (
        <div className={combineThemeClasses("absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10", themeClasses.card)}>
          <div className="py-1">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Archive Options
              </h3>
            </div>
            
            <div className="px-4 py-2">
              <button
                onClick={handleSelectAll}
                className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
              >
                {allItemsSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {items.map((item) => (
              <div key={item.id} className="px-4 py-1">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => handleSelectItem(item.id)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {item.title || item.invoiceNumber || item.name}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {hasSelectedItems && (
              <button
                onClick={handleArchiveSelected}
                className="w-full btn btn-primary text-sm"
              >
                <Archive className="h-4 w-4 mr-2" />
                {archiveSelectedLabel} ({selectedItems.length})
              </button>
            )}
            
            <button
              onClick={handleArchiveAll}
              className="w-full btn btn-secondary text-sm"
            >
              <Archive className="h-4 w-4 mr-2" />
              {archiveAllLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArchiveButton
