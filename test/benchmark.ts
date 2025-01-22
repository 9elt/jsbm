function wait(ms: number) {
    const start = performance.now();
    while (performance.now() - start < ms);
}

/** @jsbm statement-100μs */
wait(0.1);

/**
 * @jsbm block-1.0ms
 */
{
    wait(0.5);

    /** @jsbm nest-500μs */
    wait(0.5);
}

/**
 * @jsbm declaration(1) declaration-1.0ms
 */
function declaration(ms: number) {
    wait(ms);

    /**
     * @jsbm nest-1.0ms
     */
    function nest() {
        wait(ms);
    }
}
