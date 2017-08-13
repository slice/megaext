// Quick and easy element creation
const c = (name, attrs = '', html = '', bindings = {}) => {
  let elem = document.createElement(name)
  for ([name, value] of Object.entries(attrs)) {
    elem.setAttribute(name, value)
  }
  for ([event, cb] of Object.entries(bindings)) {
    elem.addEventListener(event, cb.bind(elem))
  }
  elem.innerHTML = html
  return elem
}

const idFromUrl = (url) => {
  // Stolen from megabot ;)
  // https://github.com/SteamingMutt/DiscordFeedback/blob/master/Commands/Commands/uservoice.js#L7
  const uv = /https?:\/\/[\w.]+\/forums\/(\d{6,})-[\w-]+\/suggestions\/(\d{7,})(?:-[\w-]*)?/

  return url.match(uv)[2]
}

const help = `
  <h1>How do I use this?</h1>
  <p>
    There are <strong>two modes</strong> the floating window can be in. The <strong>floating window</strong>
    is the tiny box that you are looking at right now.
  </p>
  <h2>Dupe manager mode</h2>
  <p>
    This is the default mode. In this mode, you are shown the <strong>idea queue.</strong>
    The idea queue is a list of Uservoice ideas that you will merge into the <strong>merging into idea</strong>.
  </p>
  <p>
    To set the <strong>merging into idea</strong>, click the <code>*</code> button on an idea.
    This is the idea that you will be merging all of the ideas in the idea queue into. That's why it's called
    the <strong>merging into idea</strong>.
  </p>
  <p>
    To add an idea to the idea queue, click the <code>+</code> button next to it. The floating window will
    instantly update to show the newly added idea. To remove an idea from the idea queue, ensure that the
    <strong>delete on click</strong> checkbox is selected. Then, hover over the idea you want to delete. It should
    turn red. Then, click to delete the idea from the idea queue.
  </p>
  <h2>Delete on click</h2>
  <p>
    If this checkbox is ticked, clicking on any idea will remove it from the idea queue. If this checkbox is not ticked,
    clicking on any idea will open the idea in a new tab. This checkbox is unticked by default and does not persist
    between page loads. If an idea turns blue, it will open upon being clicked, and if an idea turns red, it will be
    deleted upon being clicked. There is no confirmation preceding deletion.
  </p>
  <p>
    Like ideas, the <strong>merging into idea</strong> can be opened by clicking, but cannot be deleted with
    <strong>delete on click</strong>.
  </p>
  <h2>Command mode</h2>
  <p>
    This mode shows the commands you need to paste into #uv-reporting. Each line is a command. Note that the commands
    may appear differently depending on if the <strong>shorten urls</strong> checkbox is ticked.
  </p>
  <h2>Shorten URLs</h2>
  <p>
    This checkbox will make all UV URLs only show the title slug and ID. In command mode, it will only output
    UV idea IDs instead of URLs. MegaBot processes IDs correctly, so this checkbox only has visual effect.
  </p>
  <h2>Moving between modes</h2>
  <p>
    You can move between modes by clicking the <strong>"show commands"/"show dupe manager"</strong> button.
  </p>
  <h2>Help</h2>
  <p>
    Need help? Press the <code>?</code> button. While help is showing, nothing else will show. To hide help,
    press the button again.
  </p>
`

const template = `
  <div class="mega-manager">
    <div class="mega-manager-contents" v-if="!hidden && !help">
      <div class="dupe-manager" v-if="!showCommands">
        <div class="into">
          <span v-if="into" @click='openInto'>
            <strong>Merging into: </strong> {{ shorten(into) }}
          </span>
          <span v-else>
            <span class="muted">Not merging into anything at the moment.</span>
          </span>
        </div>
        <div :class="{'delete-on-click': deleteOnClick}"
              class="dupe" v-for="(dupe, index) in dupes" @click="action(index)">
          {{ shorten(dupe) }}
        </div>
        <div class="muted" v-if="dupes.length === 0">
          No duplicates in the queue. Add one with the + button.
        </div>
      </div>
      <div class="commands" v-else>
        <pre>{{ commands }}</pre>
      </div>
      <div class="toolbar">
        <button type="button" @click="showCommands = !showCommands">
          Show {{ showCommands ? "dupe manager" : "commands" }}
        </button>
        <label>
          <input type="checkbox" v-model="short">
          Shorten urls
        </label>
        <label v-if="!showCommands">
          <input type="checkbox" v-model="deleteOnClick">
          Delete on click
        </label>
      </div>
    </div>
    <div class="help" v-if="help">
      ${help}
    </div>
    <button type="button" class="hide" @click="hidden = !hidden">
      {{ hidden ? 'Show' : 'Hide' }}
    </button>
    <button type="button" @click="help = !help">
      ?
    </button>
    <span class="muted version">{{ version }}</span>
  </div>
`
document.body.appendChild(c('div', { id: 'manager' }, template))
let vm = new Vue({
  el: '#manager',
  data: {
    // Duplicate list and merge into URL (handled by other extension code)
    dupes: localStorage.dupes ? JSON.parse(localStorage.dupes) : [],
    into: localStorage.into || null,

    // Are we in the generated command view?
    showCommands: false,

    // Is the help showing?
    help: false,

    // Should UV URLs be shortened to IDs and or names only? (Applies both in the dupe manager
    // and in the generated command view)
    short: true,

    // Megaext version
    version: chrome.runtime.getManifest().version,

    // Is the toolbar and "main content window" hidden?
    hidden: false,

    // Specifies whether ideas in the queue should be deleted when being hovered over.
    deleteOnClick: false
  },
  computed: {
    commands () {
      if (!this.into || !this.dupes || this.dupes.length === 0) {
        return 'Provide at least 1 dupe and an idea to merge into.'
      }

      // Generate commands
      const id = this.short ? idFromUrl : (u) => u
      return this.dupes.map((dupe, index) => {
        return `!dupe ${id(dupe)} ${index > 0 ? '-' : id(this.into)}`
      }).join('\n')
    }
  },
  methods: {
    openInto () {
      window.open(this.into)
    },
    shorten (url) {
      // Method instead of filter because of this.short
      return this.short ?
        url.replace('https://feedback.discordapp.com/forums/326712-discord-dream-land/suggestions/', '[...]/')
        : url
    },
    action (index) {
      if (this.deleteOnClick) {
        this.dupes.splice(index, 1)
        localStorage.dupes = JSON.stringify(this.dupes)
      } else {
        window.open(this.dupes[index])
      }
    }
  }
})

function addDupe (url) {
  if (!localStorage.dupes) {
    localStorage.dupes = '[]'
  }

  // Get existing dupes
  let dupes = JSON.parse(localStorage.dupes)

  // If it's already in there, bail
  if (dupes.includes(url)) {
    return false
  }

  // Concat dupes array + save
  dupes.push(url)
  localStorage.dupes = JSON.stringify(dupes)

  // Update UI
  vm.dupes = dupes

  return true
}

const mega = {
  getIdeaUrl (idea) {
    let titleLink = idea.querySelector('.uvIdeaTitle a')
    return titleLink == null ? window.location.href : titleLink.href
  },

  setupUvIdea (idea) {
    let addButton = c('button', { type: 'button', class: 'mega-button add-dupe' }, '+', {
      click () { addDupe(mega.getIdeaUrl(idea)) }
    })

    let setInto = c('button', { type: 'button', class: 'mega-button set-into' }, '*', {
      click () {
        let url = mega.getIdeaUrl(idea)
        vm.into = url
        localStorage.into = url
      }
    })

    for (let node of [addButton, setInto]) {
      idea.appendChild(node)
    }
  },

  observe () {
    let container = document.querySelector('.uvForumSearchResults-container')

    if (!container) {
      return
    }

    let mo = new MutationObserver((records, observer) => this.updateIdeas())
    mo.observe(container, { childList: true })
  },

  updateIdeas () {
    let ideas = document.querySelectorAll('.uvIdea')

    for (let idea of ideas) {
      this.setupUvIdea(idea)
    }
  },

  load () {
    this.updateIdeas()
    this.observe()
  }
}

// setup megaext once the page has finished loading
window.addEventListener('load', mega.load.bind(mega))
