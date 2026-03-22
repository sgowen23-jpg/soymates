import { useState, useRef, useEffect } from 'react'
import { STORES } from '../data/stores'
import './StoreSearchInput.css'

export default function StoreSearchInput({ value, onChange, onSelect, placeholder = 'Search store…', className = '' }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  function handleChange(e) {
    const val = e.target.value
    onChange(val)
    if (val.trim().length < 1) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const q = val.toLowerCase()
    const matches = STORES
      .filter(s => s.name.toLowerCase().includes(q) || s.suburb.toLowerCase().includes(q))
      .slice(0, 4)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }

  function handleSelect(store) {
    onChange(store.name)
    setSuggestions([])
    setOpen(false)
    if (onSelect) onSelect(store)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setSuggestions([]); setOpen(false) }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className={`store-search-wrap ${className}`} ref={wrapRef}>
      <input
        className="store-search-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <ul className="store-suggestions">
          {suggestions.map(store => (
            <li
              key={store.id}
              className="store-suggestion-item"
              onMouseDown={() => handleSelect(store)}
            >
              <span className="suggestion-name">{store.name}</span>
              <span className="suggestion-meta">{store.suburb} · {store.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
