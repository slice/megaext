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
  // stolen from megabot ;)
  // https://github.com/SteamingMutt/DiscordFeedback/blob/master/Commands/Commands/uservoice.js#L7
  const uv = /https?:\/\/[\w.]+\/forums\/(\d{6,})-[\w-]+\/suggestions\/(\d{7,})(?:-[\w-]*)?/

  return url.match(uv)[2]
}

const template = `
  <div class="mega-manager">
    <div class="mega-manager-contents" v-if="!hidden">
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
    <button type="button" class="hide" @click="hidden = !hidden">
      {{ hidden ? 'Show' : 'Hide' }}
    </button>
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

    // Should UV URLs be shortened to IDs and or names only? (Applies both in the dupe manager
    // and in the generated command view)
    short: true,

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

  // get existing dupes
  let dupes = JSON.parse(localStorage.dupes)

  // if it's already in there, bail
  if (dupes.includes(url)) {
    return false
  }

  // concat + save
  dupes.push(url)
  localStorage.dupes = JSON.stringify(dupes)
  vm.dupes = dupes

  console.info('megaext: added dupe: %s', url)
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

// once the page has loaded, load mega in 250 ms
// we wait 250 ms to get uservoice to dynamically load all ideas
window.addEventListener('load', mega.load.bind(mega))
