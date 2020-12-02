import { execSync } from "child_process"
import execa from "execa"
import fs from "fs-extra"
import path from "path"
import { initStarter } from "../init-starter"
import { reporter } from "../reporter"

jest.mock(`tiny-spin`, () => {
  return {
    spin: (): (() => void) => jest.fn(),
  }
})
jest.mock(`../utils`)
jest.mock(`execa`)
jest.mock(`child_process`)
jest.mock(`fs-extra`)
jest.mock(`path`)
jest.mock(`../reporter`)
jest.mock(`../get-config-store`, () => {
  return {
    getConfigStore: (): unknown => {
      return {
        items: {},
        set(key: string, value: unknown): void {
          this.items[key] = value
        },
        get(key: string): unknown {
          return this.items[key]
        },

        __reset(): void {
          this.items = {}
        },
      }
    },
  }
})

describe(`init-starter`, () => {
  beforeEach(() => {
    process.chdir = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe(`initStarter / cloning`, () => {
    it(`reports an error when it s not possible to clone the repo`, async () => {
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => {
        throw new Error(`Not possible to clone the repo`)
      })

      try {
        await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])
      } catch (e) {
        expect(execa).toBeCalledWith(`git`, [
          `clone`,
          `gatsby-starter-hello-world`,
          `--recursive`,
          `--depth=1`,
          `--quiet`,
        ])
        expect(reporter.panic).toBeCalledWith(`Not possible to clone the repo`)
        expect(reporter.success).not.toBeCalledWith(
          `Created site from template`
        )
        expect(fs.remove).toBeCalledWith(`/somewhere-here`)
      }
    })

    it(`reports a success when everything is going ok`, async () => {
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])

      expect(execa).toBeCalledWith(`git`, [
        `clone`,
        `gatsby-starter-hello-world`,
        `--recursive`,
        `--depth=1`,
        `--quiet`,
      ])
      expect(reporter.panic).not.toBeCalled()
      expect(reporter.success).toBeCalledWith(`Created site from template`)
      expect(fs.remove).toBeCalledWith(`/somewhere-here`)
    })
  })

  describe(`initStarter / install`, () => {
    it(`process package installation with yarn`, async () => {
      process.env.npm_config_user_agent = `yarn`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [])

      expect(fs.remove).toBeCalledWith(`package-lock.json`)
      expect(reporter.success).toBeCalledWith(`Installed plugins`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(`yarnpkg`, [`--silent`], {
        stderr: `inherit`,
      })
    })

    it(`process package installation with NPM`, async () => {
      process.env.npm_config_user_agent = `npm`
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [
        `one-package`,
      ])

      expect(fs.remove).toBeCalledWith(`yarn.lock`)
      expect(reporter.success).toBeCalledWith(`Installed Gatsby`)
      expect(reporter.success).toBeCalledWith(`Installed plugins`)
      expect(reporter.panic).not.toBeCalled()
      expect(execa).toBeCalledWith(
        `npm`,
        [`install`, `--loglevel`, `error`, `--color`, `always`],
        { stderr: `inherit` }
      )
      expect(execa).toBeCalledWith(
        `npm`,
        [`install`, `--loglevel`, `error`, `--color`, `always`, `one-package`],
        { stderr: `inherit` }
      )
    })

    it(`gently informs the user that yarn is not available when trying to use it`, async () => {
      process.env.npm_config_user_agent = `yarn`
      ;(execSync as any).mockImplementation(() => {
        throw new Error(`Something wrong occured when trying to use yarn`)
      })
      ;(path as any).join.mockImplementation(() => `/somewhere-here`)
      ;(execa as any).mockImplementation(() => Promise.resolve())
      ;(fs as any).readJSON.mockImplementation(() => {
        return { name: `gatsby-project` }
      })

      await initStarter(`gatsby-starter-hello-world`, `./somewhere`, [
        `one-package`,
      ])

      expect(reporter.info).toBeCalledWith(
        `Woops! You have chosen "yarn" as your package manager, but it doesn't seem be installed on your machine. You can install it from https://yarnpkg.com/getting-started/install or change your preferred package manager with the command "gatsby options set pm npm". As a fallback, we will run the next steps with npm.`
      )
    })
  })
})