import React, { createContext, useContext, useReducer } from 'react'

const AuthContext = createContext()

const initialState = {
  user: JSON.parse(localStorage.getItem('loomlance-user') || 'null'),
  isAuthenticated: !!JSON.parse(localStorage.getItem('loomlance-user') || 'null'),
}

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('loomlance-user', JSON.stringify(action.payload))
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
      }
    case 'LOGOUT':
      localStorage.removeItem('loomlance-user')
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      }
    case 'UPDATE_USER':
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

  const login = (userData) => {
    dispatch({ type: 'LOGIN', payload: userData })
  }

  const logout = () => {
    dispatch({ type: 'LOGOUT' })
  }

  const updateUser = (updatedUser) => {
    localStorage.setItem('loomlance-user', JSON.stringify(updatedUser))
    dispatch({ type: 'UPDATE_USER', payload: updatedUser })
  }

  const value = {
    ...state,
    login,
    logout,
    updateUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
