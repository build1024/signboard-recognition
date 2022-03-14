import React from "react";
import ReactDOM from "react-dom";
import MagicDropzone from "react-magic-dropzone";
import "spinkit/spinkit.min.css";

import "./styles.css";
const tf = require('@tensorflow/tfjs');

const weights = './web_model/model.json';

const names = ['marufuku', 'christ'];
const fillcolors = ['#FF3838', '#AF9510'];

class App extends React.Component {
  state = {
    model: null,
    preview: "",
    predictions: [],
    loading: true
  };

  componentDidMount() {
    tf.loadGraphModel(weights).then(model => {
      this.setState({
        model: model,
        loading: false
      });
    });
  }

  onDrop = (accepted, rejected, links) => {
    accepted = accepted.map((v) => v.preview);
    if (accepted[0] || links[0]) {
      this.setState({ preview: accepted[0] || links[0], loading: true });
    }
  };

  cropToCanvas = (image, canvas, ctx) => {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;

    // canvas.width = image.width;
    // canvas.height = image.height;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const newWidth = Math.round(naturalWidth * ratio);
    const newHeight = Math.round(naturalHeight * ratio);
    ctx.drawImage(
      image,
      0,
      0,
      naturalWidth,
      naturalHeight,
      (canvas.width - newWidth) / 2,
      (canvas.height - newHeight) / 2,
      newWidth,
      newHeight,
    );

  };

  onImageChange = e => {
    const c = document.getElementById("canvas");
    const ctx = c.getContext("2d");
    this.cropToCanvas(e.target, c, ctx);
    let [modelWidth, modelHeight] = this.state.model.inputs[0].shape.slice(1, 3);
    const input = tf.tidy(() => {
      return tf.image.resizeBilinear(tf.browser.fromPixels(c), [modelWidth, modelHeight])
        .div(255.0).expandDims(0);
    });
    this.state.model.executeAsync(input).then(res => {
      // Font options.
      const font = "20px sans-serif";
      ctx.font = font;
      ctx.textBaseline = "top";

      const [boxes, scores, classes, valid_detections] = res;
      const boxes_data = boxes.dataSync();
      const scores_data = scores.dataSync();
      const classes_data = classes.dataSync();
      const valid_detections_data = valid_detections.dataSync()[0];

      tf.dispose(res)

      let label_left = Array(valid_detections_data);
      let label_top  = Array(valid_detections_data);

      var i;
      for (i = 0; i < valid_detections_data; ++i){
        if (scores_data[i] < 0.5) continue;
        let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= c.width;
        x2 *= c.width;
        y1 *= c.height;
        y2 *= c.height;
        const width = x2 - x1;
        const height = y2 - y1;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);

        // Draw the bounding box.
        ctx.strokeStyle = fillcolors[classes_data[i]];
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width, height);

        // Draw the label background.
        ctx.fillStyle = fillcolors[classes_data[i]];
        const textWidth = ctx.measureText(klass + ":" + score).width;
        const textHeight = parseInt(font, 10); // base 10
        label_left[i] = (x1 + textWidth < c.width ? x1 : c.width - textWidth);
        label_top[i] = (y1 - textHeight >= 0 ? y1 - textHeight : y1);
        ctx.fillRect(label_left[i] - 2, label_top[i] - 2, textWidth + 4, textHeight + 4);
      }
      for (i = 0; i < valid_detections_data; ++i){
        if (scores_data[i] < 0.5) continue;
        let [x1, y1, , ] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= c.width;
        y1 *= c.height;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);

        // Draw the text last to ensure it's on top.
        ctx.fillStyle = "#ffffff";
        ctx.fillText(klass + ":" + score, label_left[i], label_top[i]);

      }
      this.setState({ loading: false });
    });
  };

  render() {
    return (
      <div>
        <h1>看板認識のデモ</h1>
        <p>選択された画像に写っているマルフク看板とキリスト看板を認識します。</p>
        <div className="Dropzone-page">
          <div id="layer" className={this.state.loading ? "loading" : ""}>
            <div className="sk-chase">
              <div className="sk-chase-dot"></div>
              <div className="sk-chase-dot"></div>
              <div className="sk-chase-dot"></div>
              <div className="sk-chase-dot"></div>
              <div className="sk-chase-dot"></div>
              <div className="sk-chase-dot"></div>
            </div>
          </div>
          {this.state.model ? (
            <MagicDropzone
              className="Dropzone"
              accept="image/jpeg, image/png, .jpg, .jpeg, .png"
              multiple={false}
              onDrop={this.onDrop}
            >
              {this.state.preview ? (
                <img
                  alt="画像を表示します..."
                  onLoad={this.onImageChange}
                  className="Dropzone-img"
                  src={this.state.preview}
                  crossOrigin="anonymous"
                />
              ) : (
                "ここをクリックしてファイルを選択するか、ファイルをドロップしてください"
              )}
              <canvas id="canvas" width="640" height="640" />
            </MagicDropzone>
          ) : (
            <div className="Dropzone">モデルを読み込んでいます...</div>
          )}
        </div>
        <p><a href="https://dev.every-little.com/">メニューに戻る</a></p>
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
