module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // 1. replace import { db }
  root.find(j.ImportDeclaration)
    .filter(path => typeof path.node.source.value === 'string' && path.node.source.value.includes('lib/db.js'))
    .forEach(path => {
      path.node.source.value = path.node.source.value.replace('lib/db.js', 'lib/db-pg-adapter.js');
    });

  // 2. Wrap db.prepare().x() with await
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { name: 'db' },
          property: { name: 'prepare' }
        }
      }
    }
  }).forEach(path => {
    if (path.parentPath.node.type === 'AwaitExpression') return;
    
    // Wrap with await
    const awaitNode = j.awaitExpression(path.node);
    j(path).replaceWith(awaitNode);

    // Crawl up and make enclosing function async
    let current = path;
    while (current && current.node.type !== 'FunctionDeclaration' && current.node.type !== 'ArrowFunctionExpression' && current.node.type !== 'FunctionExpression') {
      current = current.parentPath;
    }
    if (current) {
        current.node.async = true;
        // if inside map(), Promise.all wrap
        let p = current.parentPath;
        if (p && p.node.type === 'CallExpression' && p.node.callee.property && p.node.callee.property.name === 'map') {
            if (p.parentPath.node.type !== 'AwaitExpression' && p.parentPath.node.type !== 'CallExpression') {
                const promiseAll = j.callExpression(
                    j.memberExpression(j.identifier('Promise'), j.identifier('all')),
                    [p.node]
                );
                j(p).replaceWith(j.awaitExpression(promiseAll));
                
                // Keep crawling to set parent function async
                let p2 = p;
                while (p2 && p2.node.type !== 'FunctionDeclaration' && p2.node.type !== 'ArrowFunctionExpression' && p2.node.type !== 'FunctionExpression') {
                  p2 = p2.parentPath;
                }
                if (p2) p2.node.async = true;
            }
        }
    }
  });

  // 3. Transactions db.transaction(...)()
  root.find(j.CallExpression, {
    callee: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: { name: 'db' },
        property: { name: 'transaction' }
      }
    }
  }).forEach(path => {
     if (path.parentPath.node.type === 'AwaitExpression') return;
     j(path).replaceWith(j.awaitExpression(path.node));
     
     const transactionCall = path.node.argument ? path.node.argument.callee : path.node.callee; 
     if (transactionCall && transactionCall.arguments && transactionCall.arguments[0]) {
         const arg = transactionCall.arguments[0];
         if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
             arg.async = true;
         }
     }

     let current = path;
     while (current && !['FunctionDeclaration', 'ArrowFunctionExpression', 'FunctionExpression'].includes(current.node.type)) {
       current = current.parentPath;
     }
     if (current) current.node.async = true;
  });

  return root.toSource();
};
