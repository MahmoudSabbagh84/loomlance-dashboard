import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'

const AuthContext = createContext()

const initialState = {
  user: (() => {
    try {
      return JSON.parse(localStorage.getItem('loomlance-user') ?? 'null')
    } catch {
      return null
    }
  })(),
  isAuthenticated: (() => {
    try {
      return !!JSON.parse(localStorage.getItem('loomlance-user') ?? 'null')
    } catch {
      return false
    }
  })()
}

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      try {
        localStorage.setItem('loomlance-user', JSON.stringify(action.payload))
      } catch (error) {
        console.error('Failed to save user to localStorage:', error)
      }
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
      }
    case 'LOGOUT':
      try {
        localStorage.removeItem('loomlance-user')
      } catch (error) {
        console.error('Failed to remove user from localStorage:', error)
      }
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      }
    case 'UPDATE_USER':
      try {
        localStorage.setItem('loomlance-user', JSON.stringify(action.payload))
      } catch (error) {
        console.error('Failed to update user in localStorage:', error)
      }
      return {
        ...state,
        user: action.payload
      }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  const login = useCallback((userData) => {
    dispatch({ type: 'LOGIN', payload: userData })
  }, [])

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' })
  }, [])

  const updateUser = useCallback((updatedUser) => {
    dispatch({ type: 'UPDATE_USER', payload: updatedUser })
  }, [])

  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
    updateUser
  }), [state, login, logout, updateUser])

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Context selector hooks for specific auth data
export const useUser = () => {
  const { user } = useAuth()
  return user
}

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

export const useAuthActions = () => {
  const { login, logout, updateUser } = useAuth()
  return { login, logout, updateUser }
}
