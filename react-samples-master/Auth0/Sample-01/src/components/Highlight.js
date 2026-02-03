import React, { Component } from "react";
import PropTypes from "prop-types";

import hljs from "highlight.js";
import "highlight.js/styles/monokai-sublime.css";

class Highlight extends Component {
  constructor(props) {
    super(props);

    this.state = { loaded: false };
    this.codeNode = React.createRef();
  }

  componentDidMount() {
    this.setState({ loaded: true }, this.highlight);
  }

  componentDidUpdate() {
    this.highlight();
  }

  highlight = () => {
    if (!this.codeNode || !this.codeNode.current) return;
    if (hljs.highlightElement) {
      hljs.highlightElement(this.codeNode.current);
    } else {
      hljs.highlightBlock(this.codeNode.current);
    }
  };

  render() {
    const { language, children } = this.props;
    const { loaded } = this.state;

    if (!loaded) {
      return null;
    }

    return (
      <pre className="rounded">
        <code ref={this.codeNode} className={language ? `language-${language}` : ""}>
          {children}
        </code>
      </pre>
    );
  }
}

Highlight.propTypes = {
  children: PropTypes.node.isRequired,
  language: PropTypes.string,
};

Highlight.defaultProps = {
  language: "json",
};

export default Highlight;
