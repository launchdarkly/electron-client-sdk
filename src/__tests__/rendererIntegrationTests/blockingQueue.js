// A simple async queue

function BlockingQueue() {
  const queue = [];
  let closed = false;
  let signal = null;
  let promise = null;

  this.add = item => {
    queue.push(item);
    signal && signal();
  };

  this.addAll = items => {
    queue.push(...items);
    signal && signal();
  };

  this.pop = async () => {
    while (true) {
      if (closed) {
        return undefined;
      }
      if (queue.length) {
        promise = null;
        return queue.shift();
      }
      if (!promise) {
        promise = new Promise(resolve => {
          signal = resolve;
        });
      }
      await promise;
    }
  };

  this.close = () => {
    closed = true;
    signal && signal();
  };
}

module.exports = BlockingQueue;
