
_global_elements = []

class Element {
  constructor(data, parent = undefined) {
    this._data = data
    this._id = _global_elements.length
    _global_elements.push(this)
    // console.log('constructor call', data, this._id)

    this.parent = parent
    this.children = []
    this._listener = undefined
  }

  appendChild(child) {
    child.parent = this
    this.children.push(child)
    return child
  }

  renderChildren() {
    let html = ''
    for (let child of this.children)
      html += child._render()
    return html
  }

  _render() {
    return this.render(this._id, this._data)
  }
  render(id, data) { }

  _init() {
    // console.log(this, '_init', this._id)
    this.selector = document.querySelector(`#id${this._id}`)
    this.selector.addEventListener('click', this._onclick.bind(this))
    this.selector.addEventListener('change', this._onchange.bind(this))
    this.selector.addEventListener('keyup', e => { if (e.key === 'Enter') this._onchange.bind(this) })

    this.info = this.selector

    this.init(this._id, this._data)
    this.children.forEach(e => e._init())
  }
  init(id, data) { }

  oninput() { }
  onclick() { }
  onchange() { }

  _onclick() {
    // console.log('_click', this._id)
    this.onclick(this._id, this._data)
    if (this.parent != undefined) this.parent._onclick()
  }

  _onchange() {
    // console.log('_change', this._id)
    this.onchange(this._id, this._data)
    if (this.parent != undefined) this.parent._onchange()
  }

  setListener(listener) {
    this._listener = listener
  }

  setInfo(text) {
    this.info.innerText = text
  }
}

class Banner extends Element {
  render(id) { return `<div class="banner"><p id="id${id}"></p></div>` }
}

class Label extends Element {
  render(id, data) {
    let infoHtml = `<div><span id="id${id}"><span></div>`
    let labelHtml = `<div><span class="label">${data}</span></div>`
    let html = '<div class="labelGroup">' + labelHtml + infoHtml + '</div>'
    return '<div class="group">' + html + '</div>'
  }
}

class Panel extends Element {
  constructor(elements, name = '', topLevel = false) {
    super()
    elements.forEach(e => this.appendChild(e))
    this.name = name
    this.topLevel = topLevel
  }

  render(id) {
    let panelHeader = `<div class="panelHeader">${this.name}</div>`
    let panel = panelHeader + '<div class="panelBody">' + this.renderChildren() + '</div>'
    return `<div class="${this.topLevel ? 'topLevel' : 'panel'}" id="id${id}">` + panel + '</div>'
  }
}

class ArgButton extends Element {

  render(id, data) {
    let html = `<button class="functionButton btn" id="id${id}" ${data.enabled ? '' : 'disabled="true"'}>${data.name}</button>`
    html = '<div class="functionButtonDiv">' + html + '</div>'
    return html
  }

}

class TransactionElement extends Element {
  async onchange(id) {
    try { await this.buildTransactionWrapper() }
    catch { }
  }


  async onclick(id, data) {
    this.sendTransactionWrapper()
  }

  async buildTransactionWrapper() { // throws
    let tx
    let valid = true
    let msg = ''

    try { tx = await this.buildTransaction(this.getArgValues()) }
    catch (e) { msg = e; valid = false; }

    this.setInfo(msg)
    if (valid) this.button.selector.disabled = false
    else { this.button.selector.disabled = true; throw msg }

    return tx
  }

  async sendTransaction() { // throws
    let tx = await this.buildTransactionWrapper()
    return await sendTransaction(tx, this._data.type)
  }

  async sendTransactionWrapper() {  // doesn't throw
    let tx
    let valid = true
    let msg = ''

    try { tx = await this.sendTransaction() }
    catch (e) { msg = e.message; valid = false; }

    // if (valid) this.button.selector.disabled = false
    // else { this.setInfo(msg); this.button.selector.disabled = true }

    this.setInfo(msg)
    return msg
  }

}

class ArgInputField extends Element {

  render(id, data) {
    let html = ''
    html += `<input type="text" class="textInput" id="id${id}" placeholder="${data.placeholder}">`
    html += `<div class="textInputInfo"><span id="infoId${id}" class="label"></span></div>`
    if (data.standalone) html = `<div class="group"><span class="label">${data.label || ''}</span>` + html + '</div>'
    else html = '<div>' + html + '</div>'
    return html
  }

  async _onchange() {
    let value = this.getValue()
    let data = this._data
    if (data.type === 'address') this.setInfo(await getAccountInfo(value))
    if (data.type === 'addressfrom') this.setInfo(await getAccountInfo(value, 'person'))
    if (data.type === 'contract') this.setInfo(await getAccountInfo(value, 'contract'))
    if (data.type === 'erc721') this.setInfo(await getAccountInfo(value, 'erc721'))
    if (data.type === 'ether') this.setInfo(validateCurrency(value, 'ether', true))
    if (data.type === 'gwei') this.setInfo(validateCurrency(value, 'gwei', true))
    if (data.type === 'function') this.setInfo(await parseFunction(value, data.allowNegate))

    // console.log('_change', this._id)
    this.onchange(this._id, this._data)
    if (this.parent != undefined) this.parent._onchange()
  }

  init(id) {
    this.info = document.querySelector(`#infoId${id}`)
  }
  _onclick() { }

  getValue() {
    let value = this.selector.value
    if (this._data.type == 'addressfrom' && value === '') value = accounts[0]
    return value
  }

  getArgValues() {
    let arg = {}
    arg[this._data.name] = this.getValue()
    return arg
  }
}


class Function extends TransactionElement {
  render(id, data) {
    this.button = this.appendChild(new ArgButton({ name: data.methodName, enabled: data.enabled }, this))
    this.args = {}

    let html = ''
    for (let arg of data.args) {
      // arg._standalone = false
      this.args[arg.name] = this.appendChild(new ArgInputField(arg, this))
      html += this.args[arg.name]._render()
    }

    let headerHtml = `<div class="functionHeader">${data.methodName}</div>`

    html = `<div class="functionArgGroup">` + html + '</div>'
    html = this.button._render() + html
    html = '<div class="functionInputDiv">' + html + '</div>'
    html = html + `<div class="functionInfoDiv"><span class="functionInfo" id="id${id}"></span></div>`
    html = `<div class="functionGroup" id="functionGroup${id}">` + html + '</div>'
    html = '<div class="group">' + headerHtml + html + '</div>'
    return html
  }

  getArgValues() {
    return objectMap(this.args, e => e.getValue())
  }

}

class CheckBox extends Element {
  render(id, data) {
    return `<div class="group"><span class="label">${data.label}</span><input type="checkbox" id="id${id}"><span id="infoId${id}" class="label"></span></div>`
  }
  init(id) {
    this.info = document.querySelector(`#infoId${id}`)
  }

}
