const express =
  require('express');

const config =
  require('./config');

const logger =
  require('./infrastructure/logger');

const {
  createBot
} = require('./bot');


/*
 * =========================================================
 * EXPRESS SERVER
 * =========================================================
 */

const app =
  express();


app.disable(
  'x-powered-by'
);


app.use(
  express.json({
    limit: '100kb'
  })
);


/*
 * =========================================================
 * ROOT
 * =========================================================
 */

app.get(
  '/',
  (req, res) => {
    res.status(200).json({
      service:
        'Course Nibo Bot',

      status:
        'online',

      timestamp:
        new Date().toISOString()
    });
  }
);


/*
 * =========================================================
 * HEALTH
 * =========================================================
 */

app.get(
  '/health',
  (req, res) => {
    res.status(200).json({
      status:
        'ok',

      service:
        'course-nibo-bot',

      timestamp:
        new Date().toISOString()
    });
  }
);


/*
 * =========================================================
 * 404
 * =========================================================
 */

app.use(
  (req, res) => {
    res.status(404).json({
      status:
        'not_found',

      message:
        'Endpoint not found'
    });
  }
);


/*
 * =========================================================
 * EXPRESS ERROR HANDLER
 * =========================================================
 */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    logger.error(
      'Express request error',
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    res.status(500).json({
      status:
        'error',

      message:
        'Internal server error'
    });
  }
);


/*
 * =========================================================
 * START WEB SERVER
 * =========================================================
 */

const server =
  app.listen(
    config.port,
    () => {
      logger.success(
        `Web server listening on port ${config.port}`
      );
    }
  );


/*
 * =========================================================
 * TELEGRAM BOT
 * =========================================================
 */

let bot;

try {
  bot =
    createBot();

  bot.launch()
    .then(() => {
      logger.success(
        'Course Nibo + Sinthiya AI is live'
      );
    })
    .catch(
      (error) => {
        logger.error(
          'Failed to launch Telegram bot',
          error
        );

        process.exitCode =
          1;
      }
    );
} catch (error) {
  logger.error(
    'Failed to create Telegram bot',
    error
  );

  process.exitCode =
    1;
}


/*
 * =========================================================
 * GRACEFUL SHUTDOWN
 * =========================================================
 */

let shuttingDown =
  false;


async function shutdown(
  signal
) {
  if (
    shuttingDown
  ) {
    return;
  }

  shuttingDown =
    true;

  logger.info(
    `Received ${signal}. Shutting down gracefully...`
  );


  try {
    if (
      bot &&
      typeof bot.stop ===
        'function'
    ) {
      bot.stop(
        signal
      );
    }
  } catch (error) {
    logger.error(
      'Failed to stop Telegram bot',
      error
    );
  }


  try {
    server.close(
      () => {
        logger.success(
          'Web server stopped'
        );

        process.exit(0);
      }
    );
  } catch (error) {
    logger.error(
      'Failed to close web server',
      error
    );

    process.exit(1);
  }


  setTimeout(
    () => {
      logger.error(
        'Forced shutdown after timeout.'
      );

      process.exit(1);
    },
    5000
  ).unref();
}


/*
 * =========================================================
 * PROCESS EVENTS
 * =========================================================
 */

process.once(
  'SIGINT',
  () =>
    shutdown(
      'SIGINT'
    )
);


process.once(
  'SIGTERM',
  () =>
    shutdown(
      'SIGTERM'
    )
);


process.on(
  'uncaughtException',
  (error) => {
    logger.error(
      'Uncaught exception',
      error
    );
  }
);


process.on(
  'unhandledRejection',
  (reason) => {
    logger.error(
      'Unhandled promise rejection',
      reason
    );
  }
);
