import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('DSP Calculator UI', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the planner and opens the searchable recipe picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'DSP Calculator' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Production Chain' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Processor/i })[0])
    expect(screen.getByRole('dialog', { name: 'Select a Recipe' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search item or building')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search item or building'), 'matrix')
    expect(screen.getAllByTitle('Electromagnetic Matrix').length).toBeGreaterThan(0)
  })

  it('adds an output goal from global search', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByPlaceholderText('Search items...'), 'universe matrix')
    await user.click(screen.getAllByRole('button', { name: /Universe Matrix/i })[0])

    expect(screen.getAllByText('Universe Matrix').length).toBeGreaterThan(0)
  })

  it('switches from tree to graph view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Graph' }))

    expect(screen.getByLabelText('Production graph')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Graph' })).toHaveAttribute('aria-pressed', 'true')
  })
})
